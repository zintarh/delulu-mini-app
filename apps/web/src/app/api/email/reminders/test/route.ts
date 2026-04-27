import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { sendReminderEmail } from "@/lib/email/send-reminder";
import { CELO_MAINNET_ID, getSubgraphUrlForChain } from "@/lib/constant";
import {
  getDeluluCreatedAtMs,
  getMilestoneEndTimeMs,
  getMilestoneLabel,
} from "@/lib/milestone-utils";

type SubgraphDelulu = {
  id: string;
  contentHash: string;
  createdAt: string;
  stakingDeadline: string;
  resolutionDeadline: string;
  milestones: {
    milestoneId: string;
    deadline: string;
    startTime: string | null;
    milestoneURI: string | null;
    isSubmitted: boolean;
    isVerified: boolean;
  }[];
};

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.PUSH_CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get("authorization");
  const bodySecret = req.nextUrl.searchParams.get("secret");
  return authHeader === `Bearer ${secret}` || bodySecret === secret;
}

function toDateSeconds(s: string | null | undefined): Date | null {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000);
}

function formatRemainingTime(nowSec: number, targetSec: number): string {
  const diff = targetSec - nowSec;
  if (diff <= 0) return "Ends now";
  const hours = Math.ceil(diff / 3600);
  if (hours <= 1) return "1 hour left";
  return `${hours} hours left`;
}

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

async function resolveDeluluTitle(contentHash: string): Promise<string | null> {
  if (!contentHash) return null;
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${gateway}${contentHash}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
      const data = await res.json();
      const title =
        (typeof data?.text === "string" ? data.text : "") ||
        (typeof data?.content === "string" ? data.content : "");
      if (title.trim()) return title.trim();
    } catch {
      continue;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return errorResponse("Unauthorized", 401);
    }

    if (!process.env.RESEND_API_KEY) {
      return errorResponse("Missing RESEND_API_KEY.", 500);
    }

    const body = await req.json().catch(() => ({}));
    const to = (body?.to as string | undefined)?.trim();
    const username = ((body?.username as string | undefined)?.trim() || "Visionary");
    const address = (body?.address as string | undefined)?.toLowerCase();
    const appUrl = (process.env.NEXT_PUBLIC_URL || "https://staydelulu.xyz").replace(/\/$/, "");

    if (!to || !to.includes("@")) {
      return errorResponse("Valid 'to' email is required.", 400);
    }
    if (!address || !address.startsWith("0x") || address.length !== 42) {
      return errorResponse("Valid wallet address is required.", 400);
    }

    const subgraphUrl =
      getSubgraphUrlForChain(CELO_MAINNET_ID) || process.env.NEXT_PUBLIC_SUBGRAPH_URL;
    if (!subgraphUrl) {
      return errorResponse("Missing subgraph URL.", 500);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const windowEndSec = nowSec + 24 * 60 * 60;

    const query = `
      query TestReminderDelulus($creatorVariants: [String!]) {
        delulus(
          first: 25
          orderBy: createdAt
          orderDirection: desc
          where: { creatorAddress_in: $creatorVariants, isResolved: false, isCancelled: false }
        ) {
          id
          contentHash
          createdAt
          stakingDeadline
          resolutionDeadline
          milestones(
            first: 30
            orderBy: milestoneId
            orderDirection: asc
            where: { isSubmitted: false, isVerified: false }
          ) {
            milestoneId
            deadline
            startTime
            milestoneURI
            isSubmitted
            isVerified
          }
        }
      }
    `;

    const response = await fetch(subgraphUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { creatorVariants: [address, address.toLowerCase()] },
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      return errorResponse(`Subgraph request failed: ${response.status}`, 502);
    }
    const payload = await response.json();
    const delulus: SubgraphDelulu[] = payload?.data?.delulus ?? [];

    const items: Array<{
      title: string;
      milestoneTitle: string;
      timeLeftText: string;
      ctaUrl: string;
      ctaLabel: string;
    }> = [];

    for (const d of delulus) {
      const resolutionDeadlineSec = Number(d.resolutionDeadline || "0");
      if (!Number.isFinite(resolutionDeadlineSec) || resolutionDeadlineSec <= nowSec) {
        continue;
      }

      const createdAtMs = getDeluluCreatedAtMs(
        {
          createdAt: toDateSeconds(d.createdAt) ?? undefined,
          stakingDeadline: toDateSeconds(d.stakingDeadline) ?? undefined,
        },
        Date.now(),
      );

      let prevEnd: number | null = null;
      const sortedMilestones = [...(d.milestones ?? [])].sort(
        (a, b) => Number(a.milestoneId) - Number(b.milestoneId),
      );
      const deluluTitle = (await resolveDeluluTitle(d.contentHash)) ?? "Your ongoing delulu";

      for (const m of sortedMilestones) {
        const endMs = getMilestoneEndTimeMs(
          {
            startTime: toDateSeconds(m.startTime),
            deadline: toDateSeconds(m.deadline) ?? new Date(0),
          },
          prevEnd,
          createdAtMs,
        );
        prevEnd = endMs;
        const endSec = Math.floor(endMs / 1000);
        if (endSec <= nowSec || endSec > windowEndSec) continue;

        const milestoneLabel = getMilestoneLabel(
          { milestoneId: m.milestoneId, milestoneURI: m.milestoneURI },
          80,
        );

        items.push({
          title: deluluTitle,
          milestoneTitle: milestoneLabel,
          timeLeftText: formatRemainingTime(nowSec, endSec),
          ctaUrl: `${appUrl}/delulu/${d.id}?milestone=${m.milestoneId}`,
          ctaLabel: "Submit proof",
        });
        if (items.length >= 3) break;
      }
      if (items.length >= 3) break;
    }

    if (items.length === 0) {
      return errorResponse(
        "No active milestones ending within 24 hours found for this wallet.",
        404,
      );
    }

    await sendReminderEmail(
      to,
      {
        username,
        goalTitle: "A milestone on your ongoing delulu is due within 24 hours",
        pendingHabits: items.map((i) => ({ emoji: "", ...i })),
        appUrl,
        ctaUrl: items[0]?.ctaUrl,
        ctaLabel: "Submit proof",
        manageUrl: `${appUrl}/profile`,
      },
      {
        subject: "Zinta from Delulu: real milestone reminder preview",
      },
    );

    return jsonResponse({ ok: true, sentTo: to, milestonesUsed: items.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to send test email";
    return errorResponse(msg, 500);
  }
}

