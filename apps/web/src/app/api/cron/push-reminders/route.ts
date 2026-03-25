import { NextRequest } from "next/server";
import webpush from "web-push";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getSubgraphUrlForChain, CELO_MAINNET_ID } from "@/lib/constant";
import {
  getDeluluCreatedAtMs,
  getMilestoneEndTimeMs,
} from "@/lib/milestone-utils";

type SubgraphMilestoneRow = {
  id: string;
  milestoneId: string;
  deadline: string;
  startTime: string | null;
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
  if (!secret) return true; // allow if not configured (dev)
  const header = req.headers.get("x-cron-secret");
  const qp = req.nextUrl.searchParams.get("secret");
  return header === secret || qp === secret;
}

function configureVapid() {
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@staydelulu.xyz";
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

async function fetchJson(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    // Cron should always be fresh
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
  kind: "milestone_due_30m" | "delulu_end_30m";
  deluluId: string;
  milestoneId?: string;
  address: string;
  scheduledForSec: number;
}) {
  return [kind, deluluId, milestoneId ?? "-", address.toLowerCase(), String(scheduledForSec)].join(
    ":",
  );
}

export async function GET(req: NextRequest) {
  try {
    if (!requireCronAuth(req)) {
      return errorResponse("Unauthorized", 401);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return errorResponse("Missing Supabase credentials.", 500);
    }

    if (!configureVapid()) {
      return errorResponse("Missing VAPID keys.", 500);
    }

    const subgraphUrl = getSubgraphUrlForChain(CELO_MAINNET_ID) || process.env.NEXT_PUBLIC_SUBGRAPH_URL;
    if (!subgraphUrl) {
      return errorResponse("Missing subgraph URL.", 500);
    }

    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    // 30 min reminder, with jitter tolerance: [25m, 35m]
    const windowStartSec = nowSec + 25 * 60;
    const windowEndSec = nowSec + 35 * 60;

    // 1) Milestone reminders: milestones whose computed end is within window, and not submitted/verified.
    // We fetch milestones with deadlines in a broad range and then compute exact end time using shared logic.
    const milestoneQuery = `
      query MilestonesForReminders($from: BigInt!, $to: BigInt!) {
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

    // Use a wider server-side filter to avoid missing items if deadline field is 0 and computed via chaining.
    const from = String(nowSec - 60 * 60);
    const to = String(windowEndSec + 60 * 60);
    const milestoneResp = await fetchJson(subgraphUrl, {
      query: milestoneQuery,
      variables: { from, to },
    });

    const milestones: SubgraphMilestoneRow[] =
      milestoneResp?.data?.milestones ?? [];

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

      // Note: this intentionally reuses the exact same helper used by the UI,
      // so the reminder schedule matches what users see.
      const endMs = getMilestoneEndTimeMs(
        {
          startTime: toDateSeconds(m.startTime),
          deadline: toDateSeconds(m.deadline) ?? new Date(0),
        },
        null,
        createdAtMs,
      );
      const endSec = Math.floor(endMs / 1000);

      // Only send if end is in the target window and still not submitted/verified.
      if (endSec < windowStartSec || endSec > windowEndSec) {
        skipped++;
        continue;
      }

      const scheduledForSec = endSec - 30 * 60;
      const eventKey = makeEventKey({
        kind: "milestone_due_30m",
        deluluId: m.delulu.id,
        milestoneId: m.milestoneId,
        address: creatorAddress,
        scheduledForSec,
      });

      // idempotency insert; if duplicate, skip
      const { error: insertErr } = await supabase.from("push_events_sent").insert({
        event_key: eventKey,
        address: creatorAddress,
      });
      if (insertErr) {
        skipped++;
        continue;
      }

      const { data: sub, error: subErr } = await supabase
        .from("push_subscriptions")
        .select("endpoint,p256dh,auth")
        .eq("address", creatorAddress)
        .is("disabled_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subErr || !sub) {
        skipped++;
        continue;
      }

      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: "Proof due soon",
          body: "Your milestone proof is due in 30 minutes.",
          url: `/delulu/${m.delulu.id}?milestone=${m.milestoneId}`,
        }),
      );
      sent++;
    }

    // 2) Delulu end reminders: resolutionDeadline within window
    const deluluQuery = `
      query DelulusForEndReminders($from: BigInt!, $to: BigInt!) {
        delulus(
          first: 1000
          where: { resolutionDeadline_gte: $from, resolutionDeadline_lte: $to, isCancelled: false }
          orderBy: resolutionDeadline
          orderDirection: asc
        ) {
          id
          creatorAddress
          resolutionDeadline
        }
      }
    `;
    const deluluResp = await fetchJson(subgraphUrl, {
      query: deluluQuery,
      variables: { from: String(windowStartSec), to: String(windowEndSec) },
    });

    const delulus: Array<{
      id: string;
      creatorAddress: string;
      resolutionDeadline: string;
    }> = deluluResp?.data?.delulus ?? [];

    for (const d of delulus) {
      const creatorAddress = (d.creatorAddress || "").toLowerCase();
      if (!creatorAddress.startsWith("0x") || creatorAddress.length !== 42) {
        skipped++;
        continue;
      }
      const endSec = Number(d.resolutionDeadline);
      if (!Number.isFinite(endSec) || endSec <= 0) {
        skipped++;
        continue;
      }
      const scheduledForSec = endSec - 30 * 60;
      const eventKey = makeEventKey({
        kind: "delulu_end_30m",
        deluluId: d.id,
        address: creatorAddress,
        scheduledForSec,
      });

      const { error: insertErr } = await supabase.from("push_events_sent").insert({
        event_key: eventKey,
        address: creatorAddress,
      });
      if (insertErr) {
        skipped++;
        continue;
      }

      const { data: sub, error: subErr } = await supabase
        .from("push_subscriptions")
        .select("endpoint,p256dh,auth")
        .eq("address", creatorAddress)
        .is("disabled_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subErr || !sub) {
        skipped++;
        continue;
      }

      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: "Delulu ending soon",
          body: "Your delulu ends in 30 minutes.",
          url: `/delulu/${d.id}`,
        }),
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
  } catch (e: any) {
    return errorResponse(e?.message ?? "Cron failed", 500);
  }
}

