export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import webpush from "web-push";
import { errorResponse, jsonResponse } from "@/lib/api";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { createNotification } from "@/lib/notifications";
import { getSubgraphUrlForChain, CELO_MAINNET_ID } from "@/lib/constant";
import {
  getDeluluCreatedAtMs,
  getMilestoneEndTimeMs,
} from "@/lib/milestone-utils";
import { notifyManyRecipients } from "@/lib/push/notify-recipients";
import { buildOffChainMilestoneSchedule } from "@/lib/community/milestone-submit-eligibility";
import { PARTICIPATING_STATUSES, isCampaignEndedByDate } from "@/lib/community/campaign-types";

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

export const maxDuration = 300;

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

type CampaignPushStats = { sent: number; skipped: number };

/** Push version of email-reminders' off-chain milestone schedule reminder,
 * widened to cover all live (on-chain) campaigns since every campaign that
 * can actually be joined has an on_chain_challenge_id by the time it's
 * participatable. */
async function sendCampaignMilestoneDuePushReminders(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  windowStartSec: number,
  windowEndSec: number,
): Promise<CampaignPushStats> {
  const stats: CampaignPushStats = { sent: 0, skipped: 0 };
  const nowMs = Date.now();

  const { data: campaignData, error: campaignErr } = await supabase
    .from("community_campaigns")
    .select("id, title, display_ends_at, duration_days, proof_cadence")
    .in("status", [...PARTICIPATING_STATUSES]);

  if (campaignErr) {
    console.error("[push-reminders] campaign query error:", campaignErr.message);
    return stats;
  }

  const activeCampaigns = (campaignData ?? []).filter(
    (c) => !isCampaignEndedByDate((c as { display_ends_at: string | null }).display_ends_at),
  );
  if (activeCampaigns.length === 0) return stats;

  const campaignIds = activeCampaigns.map((c) => (c as { id: string }).id);

  const [participantResult, milestoneResult] = await Promise.all([
    supabase
      .from("campaign_participants")
      .select("campaign_id, wallet_address")
      .in("campaign_id", campaignIds)
      .eq("status", "joined"),
    supabase
      .from("campaign_milestones")
      .select("campaign_id, title, order_index")
      .in("campaign_id", campaignIds)
      .order("order_index", { ascending: true }),
  ]);

  const participants = participantResult.data ?? [];
  if (participants.length === 0) return stats;

  const allAddresses = [
    ...new Set(
      participants.map((p) => (p as { wallet_address: string }).wallet_address.toLowerCase()),
    ),
  ];

  const { data: proofData } = await supabase
    .from("campaign_proof_submissions")
    .select("campaign_id, wallet_address, milestone_id")
    .in("campaign_id", campaignIds)
    .in("wallet_address", allAddresses)
    .eq("status", "approved");

  const completedMap = new Map<string, Set<number>>();
  for (const p of proofData ?? []) {
    const row = p as { campaign_id: string; wallet_address: string; milestone_id?: number | null };
    if (row.milestone_id == null) continue;
    const key = `${row.campaign_id}:${row.wallet_address.toLowerCase()}`;
    if (!completedMap.has(key)) completedMap.set(key, new Set());
    completedMap.get(key)!.add(row.milestone_id);
  }

  const milestonesByCampaign = new Map<string, { title: string; order_index: number }[]>();
  for (const m of milestoneResult.data ?? []) {
    const cid = (m as { campaign_id: string }).campaign_id;
    if (!milestonesByCampaign.has(cid)) milestonesByCampaign.set(cid, []);
    milestonesByCampaign.get(cid)!.push({
      title: (m as { title: string }).title,
      order_index: Number((m as { order_index: number }).order_index),
    });
  }

  const campaignById = new Map<
    string,
    { title: string; display_ends_at: string | null; duration_days: number; proof_cadence: string }
  >();
  for (const c of activeCampaigns) {
    campaignById.set((c as { id: string }).id, {
      title: (c as { title: string }).title,
      display_ends_at: (c as { display_ends_at: string | null }).display_ends_at,
      duration_days: Number((c as { duration_days: number }).duration_days ?? 30),
      proof_cadence: (c as { proof_cadence?: string }).proof_cadence ?? "daily",
    });
  }

  for (const participant of participants) {
    const pRow = participant as { campaign_id: string; wallet_address: string };
    const address = pRow.wallet_address.toLowerCase();
    const campaignId = pRow.campaign_id;
    const campaign = campaignById.get(campaignId);
    if (!campaign) continue;

    const allMilestones = milestonesByCampaign.get(campaignId) ?? [];
    if (allMilestones.length === 0) continue;

    const completedSet = completedMap.get(`${campaignId}:${address}`) ?? new Set<number>();

    const schedule = buildOffChainMilestoneSchedule({
      displayEndsAt: campaign.display_ends_at,
      durationDays: campaign.duration_days,
      proofCadence: campaign.proof_cadence,
      milestones: allMilestones,
      completedOrderIndices: completedSet,
      nowMs,
    });

    for (const m of schedule) {
      if (m.completed || m.is_overdue) continue;
      const deadlineSec = m.deadline ? Math.floor(new Date(m.deadline).getTime() / 1000) : null;
      if (!deadlineSec) continue;
      if (deadlineSec <= windowStartSec || deadlineSec > windowEndSec) continue;

      const result = await notifyManyRecipients(supabase, [address], {
        title: "Proof due soon",
        body: `"${m.label}" in ${campaign.title} is due in 30 minutes.`,
        url: `/community/campaigns/${campaignId}`,
        type: "campaign_milestone_due",
        message: `Your proof for **${m.label}** in **${campaign.title}** is due in **30 minutes**.`,
        eventKeyFor: (addr) =>
          `campaign_milestone_due_30m_push:${campaignId}:${m.milestone_id}:${addr}`,
      });
      stats.sent += result.sent;
      stats.skipped += result.skipped;
    }
  }

  return stats;
}

/** Whole-campaign "ending soon" push, fanned out to every joined participant. */
async function sendCampaignEndingPushReminders(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  windowStartSec: number,
  windowEndSec: number,
): Promise<CampaignPushStats> {
  const stats: CampaignPushStats = { sent: 0, skipped: 0 };

  const { data: campaignData, error: campaignErr } = await supabase
    .from("community_campaigns")
    .select("id, title, display_ends_at")
    .in("status", [...PARTICIPATING_STATUSES]);

  if (campaignErr) {
    console.error("[push-reminders] campaign ending query error:", campaignErr.message);
    return stats;
  }

  const endingSoon = (campaignData ?? []).filter((c) => {
    const row = c as { display_ends_at: string | null };
    if (!row.display_ends_at) return false;
    const endSec = Math.floor(new Date(row.display_ends_at).getTime() / 1000);
    return endSec > windowStartSec && endSec <= windowEndSec;
  });
  if (endingSoon.length === 0) return stats;

  const campaignIds = endingSoon.map((c) => (c as { id: string }).id);
  const { data: participantData } = await supabase
    .from("campaign_participants")
    .select("campaign_id, wallet_address")
    .in("campaign_id", campaignIds)
    .eq("status", "joined");

  const addressesByCampaign = new Map<string, string[]>();
  for (const p of participantData ?? []) {
    const row = p as { campaign_id: string; wallet_address: string };
    if (!addressesByCampaign.has(row.campaign_id)) addressesByCampaign.set(row.campaign_id, []);
    addressesByCampaign.get(row.campaign_id)!.push(row.wallet_address);
  }

  for (const c of endingSoon) {
    const row = c as { id: string; title: string };
    const addresses = addressesByCampaign.get(row.id) ?? [];
    if (addresses.length === 0) continue;

    const result = await notifyManyRecipients(supabase, addresses, {
      title: "Campaign ending soon",
      body: `"${row.title}" ends in 30 minutes.`,
      url: `/community/campaigns/${row.id}`,
      type: "campaign_ending",
      message: `**${row.title}** ends in **30 minutes**.`,
      eventKeyFor: (addr) => `campaign_ending_30m_push:${row.id}:${addr}`,
    });
    stats.sent += result.sent;
    stats.skipped += result.skipped;
  }

  return stats;
}

export async function GET(req: NextRequest) {
  try {
    if (!isCronAuthorized(req)) {
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
      await createNotification({
        recipientAddress: creatorAddress,
        type: "milestone_due",
        message: "Your milestone proof is due in **30 minutes**.",
        actionUrl: `/delulu/${m.delulu.id}?milestone=${m.milestoneId}`,
      });
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
      await createNotification({
        recipientAddress: creatorAddress,
        type: "delulu_ending",
        message: "Your delulu ends in **30 minutes**.",
        actionUrl: `/delulu/${d.id}`,
      });
      sent++;
    }

    const campaignMilestoneStats = await sendCampaignMilestoneDuePushReminders(
      supabase,
      windowStartSec,
      windowEndSec,
    );
    const campaignEndingStats = await sendCampaignEndingPushReminders(
      supabase,
      windowStartSec,
      windowEndSec,
    );

    return jsonResponse({
      ok: true,
      nowSec,
      windowStartSec,
      windowEndSec,
      sent,
      skipped,
      campaigns: {
        milestoneDue: campaignMilestoneStats,
        ending: campaignEndingStats,
      },
    });
  } catch (e: any) {
    return errorResponse(e?.message ?? "Cron failed", 500);
  }
}

