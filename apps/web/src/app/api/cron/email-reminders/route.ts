import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getSubgraphUrlForChain, CELO_MAINNET_ID } from "@/lib/constant";
import {
  getDeluluCreatedAtMs,
  getMilestoneEndTimeMs,
  getMilestoneLabel,
} from "@/lib/milestone-utils";
import { sendReminderEmail } from "@/lib/email/send-reminder";

// Temporary safety mode for production testing.
// While enabled, cron only sends to this inbox (not real users).
const TEST_RECIPIENT_EMAIL = "zintarh2024@gmail.com";
const TEST_MODE_ENABLED = false;
const MAX_TEST_EMAILS_PER_RUN = 1;

type SubgraphMilestoneRow = {
  id: string;
  milestoneId: string;
  deadline: string;
  startTime: string | null;
  milestoneURI: string | null;
  isSubmitted: boolean;
  isVerified: boolean;
  delulu: {
    id: string;
    creatorAddress: string;
    contentHash: string;
    createdAt: string;
    stakingDeadline: string;
    resolutionDeadline: string;
    isResolved: boolean;
    isCancelled: boolean;
  };
};

function requireCronAuth(req: NextRequest) {
  const secret = process.env.PUSH_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");
  const qp = req.nextUrl.searchParams.get("secret");
  return header === secret || qp === secret || authHeader === `Bearer ${secret}`;
}

async function fetchJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Subgraph request failed: ${res.status}`);
  return res.json();
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

function makeEventKey({
  kind,
  deluluId,
  milestoneId,
  address,
  scheduledForSec,
}: {
  kind: string;
  deluluId: string;
  milestoneId?: string;
  address: string;
  scheduledForSec: number;
}) {
  return [kind, deluluId, milestoneId ?? "-", address.toLowerCase(), String(scheduledForSec)].join(":");
}

function isValidEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  if (email.endsWith("@wallet.local")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function GET(req: NextRequest) {
  try {
    if (!requireCronAuth(req)) {
      return errorResponse("Unauthorized", 401);
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return errorResponse("Missing RESEND_API_KEY.", 500);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return errorResponse("Missing Supabase credentials.", 500);
    }

    const subgraphUrl =
      getSubgraphUrlForChain(CELO_MAINNET_ID) || process.env.NEXT_PUBLIC_SUBGRAPH_URL;
    if (!subgraphUrl) {
      return errorResponse("Missing subgraph URL.", 500);
    }

    const appUrl = (process.env.NEXT_PUBLIC_URL || "https://staydelulu.xyz").replace(/\/$/, "");

    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    // 30-minute cadence: remind milestones ending within next 1 hour.
    const windowStartSec = nowSec;
    const windowEndSec = nowSec + 60 * 60;

    const milestoneQuery = `
      query MilestonesForEmailReminders($from: BigInt!, $to: BigInt!) {
        milestones(
          first: 1000
          where: { deadline_gte: $from, deadline_lte: $to, isSubmitted: false, isVerified: false }
          orderBy: deadline
          orderDirection: asc
        ) {
          id
          milestoneId
          deadline
          startTime
          milestoneURI
          isSubmitted
          isVerified
          delulu {
            id
            creatorAddress
            contentHash
            createdAt
            stakingDeadline
            resolutionDeadline
            isResolved
            isCancelled
          }
        }
      }
    `;

    // Broad server-side filter to catch chained milestone deadlines
    const from = String(nowSec - 60 * 60);
    const to = String(windowEndSec + 60 * 60);
    const milestoneResp = await fetchJson(subgraphUrl, {
      query: milestoneQuery,
      variables: { from, to },
    });

    const milestones: SubgraphMilestoneRow[] = milestoneResp?.data?.milestones ?? [];

    let sent = 0;
    let skipped = 0;
    let sendErrors = 0;

    for (const m of milestones) {
      const creatorAddress = (m.delulu?.creatorAddress || "").toLowerCase();
      if (!creatorAddress.startsWith("0x") || creatorAddress.length !== 42) {
        skipped++;
        continue;
      }

      const resolutionDeadlineSec = Number(m.delulu.resolutionDeadline || "0");
      const isDeluluOngoing =
        !m.delulu.isResolved &&
        !m.delulu.isCancelled &&
        Number.isFinite(resolutionDeadlineSec) &&
        resolutionDeadlineSec > nowSec;
      if (!isDeluluOngoing) {
        skipped++;
        continue;
      }

      const deluluCreatedAt =
        toDateSeconds(m.delulu.createdAt) ?? toDateSeconds(m.delulu.stakingDeadline);
      const createdAtMs = getDeluluCreatedAtMs(
        {
          createdAt: deluluCreatedAt ?? undefined,
          stakingDeadline: toDateSeconds(m.delulu.stakingDeadline) ?? undefined,
        },
        nowMs,
      );

      const endMs = getMilestoneEndTimeMs(
        {
          startTime: toDateSeconds(m.startTime),
          deadline: toDateSeconds(m.deadline) ?? new Date(0),
        },
        null,
        createdAtMs,
      );
      const endSec = Math.floor(endMs / 1000);

      if (endSec < windowStartSec || endSec > windowEndSec) {
        skipped++;
        continue;
      }
      if (endSec <= nowSec) {
        skipped++;
        continue;
      }

      // Stable reminder anchor (exact 1h-before point), prevents overlap spam.
      const scheduledForSec = endSec - 60 * 60;
      const eventKey = makeEventKey({
        kind: "milestone_due_1h_email",
        deluluId: m.delulu.id,
        milestoneId: m.milestoneId,
        address: creatorAddress,
        scheduledForSec,
      });

      // Idempotency insert; skip if already sent
      const { error: insertErr } = await supabase.from("push_events_sent").insert({
        event_key: eventKey,
        address: creatorAddress,
      });
      if (insertErr) {
        skipped++;
        continue;
      }

      // Look up user profile for personalization (email may be overridden by test mode)
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("email, username")
        .eq("address", creatorAddress)
        .maybeSingle();

      if (profileErr) {
        skipped++;
        continue;
      }
      if (!TEST_MODE_ENABLED && !profile?.email) {
        skipped++;
        continue;
      }

      const recipientEmail = TEST_MODE_ENABLED
        ? TEST_RECIPIENT_EMAIL
        : (profile?.email as string);

      const milestoneLabel = getMilestoneLabel(
        { milestoneId: m.milestoneId, milestoneURI: m.milestoneURI },
        80,
      );
      const deluluTitle =
        (await resolveDeluluTitle(m.delulu.contentHash)) ??
        "Your ongoing delulu";

      if (!TEST_MODE_ENABLED && !isValidEmail(recipientEmail)) {
        skipped++;
        continue;
      }

      const milestoneUrl = `${appUrl}/delulu/${m.delulu.id}?milestone=${m.milestoneId}`;
      try {
        await sendReminderEmail(
          recipientEmail,
          {
            username: (profile as any)?.username ?? "Visionary",
            goalTitle: "A milestone on your ongoing delulu is due in about 1 hour",
            pendingHabits: [
              {
                emoji: "",
                title: deluluTitle,
                milestoneTitle: milestoneLabel,
                timeLeftText: formatRemainingTime(nowSec, endSec),
                ctaUrl: milestoneUrl,
                ctaLabel: "Submit proof",
              },
            ],
            appUrl,
            ctaUrl: milestoneUrl,
            ctaLabel: "Submit proof",
            manageUrl: `${appUrl}/profile`,
          },
          {
            subject: `Zinta from Delulu: ${milestoneLabel} is due soon on "${deluluTitle}"`,
          },
        );
        sent++;
      } catch (sendErr: any) {
        sendErrors++;
        skipped++;
        console.error("[email-reminders] send failed:", {
          address: creatorAddress,
          recipientEmail,
          deluluId: m.delulu.id,
          milestoneId: m.milestoneId,
          message: String(sendErr?.message || sendErr),
        });
        continue;
      }

      // In test mode, send at most one email per run.
      if (TEST_MODE_ENABLED && sent >= MAX_TEST_EMAILS_PER_RUN) {
        break;
      }
    }

    return jsonResponse({
      ok: true,
      nowSec,
      windowStartSec,
      windowEndSec,
      sent,
      skipped,
      sendErrors,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cron failed";
    return errorResponse(msg, 500);
  }
}
