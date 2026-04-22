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
    createdAt: string;
    stakingDeadline: string;
    resolutionDeadline: string;
  };
};

function requireCronAuth(req: NextRequest) {
  const secret = process.env.PUSH_CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get("x-cron-secret");
  const qp = req.nextUrl.searchParams.get("secret");
  return header === secret || qp === secret;
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

function toDateSeconds(s: string | null | undefined): Date | null {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000);
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
    // 1 hour reminder, with jitter tolerance: [55m, 65m]
    const windowStartSec = nowSec + 55 * 60;
    const windowEndSec = nowSec + 65 * 60;

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
            createdAt
            stakingDeadline
            resolutionDeadline
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

    for (const m of milestones) {
      const creatorAddress = (m.delulu?.creatorAddress || "").toLowerCase();
      if (!creatorAddress.startsWith("0x") || creatorAddress.length !== 42) {
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

      // Look up user email and username from profiles table
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("email, username")
        .eq("address", creatorAddress)
        .maybeSingle();

      if (profileErr || !profile?.email) {
        skipped++;
        continue;
      }

      const milestoneLabel = getMilestoneLabel(
        { milestoneId: m.milestoneId, milestoneURI: m.milestoneURI },
        80,
      );

      const milestoneUrl = `${appUrl}/delulu/${m.delulu.id}?milestone=${m.milestoneId}`;
      await sendReminderEmail(
        (profile as any).email,
        {
          username: (profile as any).username ?? "Visionary",
          goalTitle: "Complete your milestone before expiry",
          pendingHabits: [{ emoji: "⏰", title: milestoneLabel }],
          appUrl,
          ctaUrl: milestoneUrl,
          ctaLabel: "Submit proof now",
          manageUrl: `${appUrl}/profile`,
        },
        {
          subject: `⏰ 1 hour left on "${milestoneLabel}" — don't let it expire`,
        },
      );
      sent++;
    }

    return jsonResponse({
      ok: true,
      nowSec,
      windowStartSec,
      windowEndSec,
      sent,
      skipped,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cron failed";
    return errorResponse(msg, 500);
  }
}
