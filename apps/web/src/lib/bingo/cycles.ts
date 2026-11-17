import type { getSupabaseAdmin } from "@/lib/push/supabase";
import {
  challengeIdFromCreateTx,
  readChallenge,
  sendAddDailyMilestones,
  sendAddWindowMilestones,
  sendCreateChallenge,
  sendEndChallenge,
  sendSetEconomics,
} from "@/lib/bingo/chain";
import {
  DAY_MS,
  bonusTierKey,
  isBonusTier,
  nextLagosMidnight,
  rollingAttemptOver,
  type BingoCampaignRow,
  type BingoCycleRow,
  type BingoCycleTierRow,
  type BingoVersionRow,
} from "@/lib/bingo/types";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Cycles are set up on-chain this far ahead, so they're joinable before day 1. */
const SETUP_AHEAD_MS = 2 * DAY_MS;
/** A setup run that died mid-way is retried after this. */
const LOCK_STALE_MS = 10 * 60_000;
/** All Bingo tier campaigns live under the platform's own community. */
const PLATFORM_COMMUNITY_SLUG = "delulu";

export async function logBingoEvent(
  admin: Admin,
  e: { campaignId?: string; cycleId?: string; tierId?: string; kind: string; ok?: boolean; tx?: string | null; detail?: string },
) {
  await admin.from("bingo_events").insert({
    campaign_id: e.campaignId ?? null,
    cycle_id: e.cycleId ?? null,
    cycle_tier_id: e.tierId ?? null,
    kind: e.kind,
    ok: e.ok ?? true,
    tx_hash: e.tx ?? null,
    detail: e.detail?.slice(0, 2000) ?? null,
  });
}

export async function loadVersion(admin: Admin, versionId: string): Promise<BingoVersionRow> {
  const { data, error } = await admin.from("bingo_versions").select("*").eq("id", versionId).single();
  if (error || !data) throw new Error(`Bingo version ${versionId} not found`);
  return data as BingoVersionRow;
}

async function loadCampaign(admin: Admin, id: string): Promise<BingoCampaignRow> {
  const { data, error } = await admin.from("bingo_campaigns").select("*").eq("id", id).single();
  if (error || !data) throw new Error(`Bingo ${id} not found`);
  return data as BingoCampaignRow;
}

/** Adds the next cycle of a fixed Bingo (new rows — earlier cycles are never touched). */
export async function createCycle(
  admin: Admin,
  campaign: BingoCampaignRow,
  startsAt: Date,
): Promise<BingoCycleRow> {
  if (!campaign.current_version_id) throw new Error("This Bingo has no missions yet");
  const { data: last } = await admin
    .from("bingo_cycles")
    .select("cycle_number, ends_at")
    .eq("campaign_id", campaign.id)
    .neq("status", "cancelled")
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && Date.parse(last.ends_at as string) > startsAt.getTime()) {
    throw new Error("A new cycle can't start before the previous one ends");
  }
  const { data, error } = await admin
    .from("bingo_cycles")
    .insert({
      campaign_id: campaign.id,
      version_id: campaign.current_version_id,
      cycle_number: ((last?.cycle_number as number | undefined) ?? 0) + 1,
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + campaign.duration_days * DAY_MS).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.code === "23505" ? "That cycle already exists" : error.message);
  await logBingoEvent(admin, { campaignId: campaign.id, cycleId: data.id, kind: "cycle_created", detail: `#${data.cycle_number} from ${data.starts_at}` });
  return data as BingoCycleRow;
}

async function platformCommunityId(admin: Admin): Promise<string> {
  const { data } = await admin.from("communities").select("id").eq("slug", PLATFORM_COMMUNITY_SLUG).single();
  if (!data) throw new Error(`Community "${PLATFORM_COMMUNITY_SLUG}" not found`);
  return data.id as string;
}

/**
 * Brings one tier to "ready": its community_campaigns row, then the on-chain
 * campaign, stake economics and daily milestones. Every step re-reads the
 * chain first, so a retry after any failure resumes instead of repeating.
 */
async function ensureTierOnChain(
  admin: Admin,
  campaign: BingoCampaignRow,
  cycle: BingoCycleRow,
  tier: BingoCycleTierRow & { create_tx?: string | null },
) {
  const ev = { campaignId: campaign.id, cycleId: cycle.id, tierId: tier.id };
  let { community_campaign_id: rowId, on_chain_challenge_id: challengeId } = tier;

  if (!rowId) {
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("community_campaigns")
      .insert({
        community_id: await platformCommunityId(admin),
        title: isBonusTier(tier.tier_key) ? `${campaign.title} · Bonus: ${tier.label}` : `${campaign.title} · ${tier.label}`,
        description: campaign.description,
        cover_image_url: campaign.cover_image_url,
        proof_cadence: "daily",
        proof_instructions: "One photo per Bingo square",
        proposed_pool_amount: 0,
        status: "approved",
        approved_at: now,
        duration_days: campaign.duration_days,
        display_ends_at: cycle.ends_at,
        prize_winner_count: 10, // table allows 5/10/20; unused — Bingo has no prize pool
        forfeit_pct: tier.forfeit_pct,
        is_free_to_join: Number(tier.stake_amount) === 0,
        join_token: "G$",
        join_amount: tier.stake_amount,
        proof_type: "screenshot",
        // Never listed as a plain campaign (old app versions don't know Bingo rows) — joined from the Bingo.
        is_hidden: true,
        bingo_cycle_id: cycle.id,
        content_hash: `bingo:${cycle.id}:${tier.tier_key}`,
      })
      .select("id")
      .single();
    if (error) throw new Error(`community_campaigns insert: ${error.message}`);
    rowId = data.id as string;
    await admin.from("bingo_cycle_tiers").update({ community_campaign_id: rowId }).eq("id", tier.id);
  }

  if (challengeId == null) {
    if (tier.create_tx) {
      challengeId = await challengeIdFromCreateTx(tier.create_tx as `0x${string}`);
    } else {
      const seconds = Math.ceil((Date.parse(cycle.ends_at) - Date.now()) / 1000);
      const sent = await sendCreateChallenge(`bingo:${cycle.id}:${tier.tier_key}`, seconds, async (hash) => {
        await admin.from("bingo_cycle_tiers").update({ create_tx: hash }).eq("id", tier.id);
      });
      challengeId = sent.challengeId;
      await logBingoEvent(admin, { ...ev, kind: "chain_create", tx: sent.hash, detail: `challenge ${challengeId}` });
    }
    await admin.from("bingo_cycle_tiers").update({ on_chain_challenge_id: challengeId, setup_step: "created" }).eq("id", tier.id);
    await admin.from("community_campaigns").update({ on_chain_challenge_id: challengeId }).eq("id", rowId);
  }

  const onChain = await readChallenge(challengeId);
  if (isBonusTier(tier.tier_key)) {
    // Free to join; one window from now to the end of the cycle — any day counts.
    if (onChain.milestoneCount === 0) {
      const tx = await sendAddWindowMilestones(challengeId, [Date.parse(cycle.ends_at)], ["Bonus"]);
      await admin.from("bingo_cycle_tiers").update({ milestones_tx: tx }).eq("id", tier.id);
      await logBingoEvent(admin, { ...ev, kind: "chain_milestones", tx, detail: "bonus window" });
    }
    await admin.from("bingo_cycle_tiers").update({ setup_step: "ready", last_error: null, updated_at: new Date().toISOString() }).eq("id", tier.id);
    return;
  }
  if (!onChain.isPaid) {
    const tx = await sendSetEconomics(challengeId, Number(tier.stake_amount), tier.forfeit_pct);
    await admin.from("bingo_cycle_tiers").update({ economics_tx: tx, setup_step: "economics_set" }).eq("id", tier.id);
    await logBingoEvent(admin, { ...ev, kind: "chain_economics", tx, detail: `${tier.stake_amount} G$, ${tier.forfeit_pct}%/miss` });
  }
  if (onChain.milestoneCount === 0) {
    const tx = await sendAddDailyMilestones(challengeId, campaign.duration_days, Date.parse(cycle.starts_at) + DAY_MS);
    await admin.from("bingo_cycle_tiers").update({ milestones_tx: tx }).eq("id", tier.id);
    await logBingoEvent(admin, { ...ev, kind: "chain_milestones", tx, detail: `${campaign.duration_days} days` });
  }
  await admin.from("bingo_cycle_tiers").update({ setup_step: "ready", last_error: null, updated_at: new Date().toISOString() }).eq("id", tier.id);
}

/** Claims the cycle so two runs never send the same transactions. */
async function lockCycle(admin: Admin, cycleId: string, from: BingoCycleRow["status"][], to: BingoCycleRow["status"]) {
  const staleBefore = new Date(Date.now() - LOCK_STALE_MS).toISOString();
  const { data } = await admin
    .from("bingo_cycles")
    .update({ status: to, locked_at: new Date().toISOString() })
    .eq("id", cycleId)
    .or(`status.in.(${from.join(",")}),and(status.eq.${to},locked_at.lt.${staleBefore})`)
    .select("*");
  return (data?.[0] as BingoCycleRow | undefined) ?? null;
}

export async function setupCycle(admin: Admin, cycleId: string): Promise<{ ok: boolean; error?: string }> {
  const cycle = await lockCycle(admin, cycleId, ["scheduled", "failed"], "setting_up");
  if (!cycle) return { ok: false, error: "Cycle is already being set up or isn't waiting for setup" };
  const campaign = await loadCampaign(admin, cycle.campaign_id);
  try {
    const version = await loadVersion(admin, cycle.version_id);
    await admin.from("bingo_cycle_tiers").upsert(
      [
        ...version.tiers.map((t, i) => ({
          cycle_id: cycle.id,
          tier_key: t.key,
          label: t.label,
          stake_amount: t.stake,
          forfeit_pct: t.forfeitPct,
          sort_order: i,
        })),
        // Bonus squares: a free campaign each, so the photo is proven on-chain and earns points.
        ...version.missions.flatMap((m, i) =>
          m.bonus
            ? [{ cycle_id: cycle.id, tier_key: bonusTierKey(i), label: m.title.slice(0, 40), stake_amount: 0, forfeit_pct: 0, sort_order: 100 + i }]
            : [],
        ),
      ],
      { onConflict: "cycle_id,tier_key", ignoreDuplicates: true },
    );
    const { data: tiers } = await admin.from("bingo_cycle_tiers").select("*").eq("cycle_id", cycle.id).order("sort_order");
    for (const tier of tiers ?? []) {
      if (tier.setup_step === "ready") continue;
      await admin.from("bingo_cycle_tiers").update({ setup_attempts: (tier.setup_attempts ?? 0) + 1 }).eq("id", tier.id);
      try {
        await ensureTierOnChain(admin, campaign, cycle, tier as BingoCycleTierRow);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await admin.from("bingo_cycle_tiers").update({ last_error: msg.slice(0, 1000) }).eq("id", tier.id);
        throw err;
      }
    }
    await admin.from("bingo_cycles").update({ status: "ready", last_error: null, locked_at: null, updated_at: new Date().toISOString() }).eq("id", cycle.id);
    await logBingoEvent(admin, { campaignId: campaign.id, cycleId: cycle.id, kind: "cycle_ready" });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.from("bingo_cycles").update({ status: "failed", last_error: msg.slice(0, 1000), locked_at: null }).eq("id", cycle.id);
    await logBingoEvent(admin, { campaignId: campaign.id, cycleId: cycle.id, kind: "cycle_setup_failed", ok: false, detail: msg });
    return { ok: false, error: msg };
  }
}

/** Ends each tier on-chain (opens stake reclaim), finalises every card, archives the cycle. */
export async function endCycle(admin: Admin, cycleId: string): Promise<{ ok: boolean; error?: string }> {
  const cycle = await lockCycle(admin, cycleId, ["ready"], "ending");
  if (!cycle) return { ok: false, error: "Cycle isn't ready to end" };
  const campaign = await loadCampaign(admin, cycle.campaign_id);
  try {
    const { data: tiers } = await admin.from("bingo_cycle_tiers").select("*").eq("cycle_id", cycle.id);
    for (const tier of tiers ?? []) {
      if (tier.on_chain_challenge_id == null) continue;
      const onChain = await readChallenge(tier.on_chain_challenge_id);
      if (!onChain.ended) {
        const tx = await sendEndChallenge(tier.on_chain_challenge_id);
        await admin.from("bingo_cycle_tiers").update({ end_tx: tx }).eq("id", tier.id);
        await logBingoEvent(admin, { campaignId: campaign.id, cycleId: cycle.id, tierId: tier.id, kind: "chain_end", tx });
      }
      if (tier.community_campaign_id) {
        await admin
          .from("community_campaigns")
          .update({ ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", tier.community_campaign_id)
          .is("ended_at", null);
      }
    }
    await finalizeAttempts(admin, campaign, { cycleId: cycle.id });
    await admin
      .from("bingo_cycles")
      .update({ status: "archived", archived_at: new Date().toISOString(), locked_at: null, last_error: null })
      .eq("id", cycle.id);
    await logBingoEvent(admin, { campaignId: campaign.id, cycleId: cycle.id, kind: "cycle_archived" });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Back to ready so the next run retries the end.
    await admin.from("bingo_cycles").update({ status: "ready", last_error: msg.slice(0, 1000), locked_at: null }).eq("id", cycle.id);
    await logBingoEvent(admin, { campaignId: campaign.id, cycleId: cycle.id, kind: "cycle_end_failed", ok: false, detail: msg });
    return { ok: false, error: msg };
  }
}

/** Completed = every required square filled; anything short is "finished". */
export async function finalizeAttempts(admin: Admin, campaign: BingoCampaignRow, where: { cycleId: string } | { attemptId: string }) {
  let q = admin.from("bingo_attempts").select("id, required_filled").eq("status", "active");
  q = "cycleId" in where ? q.eq("cycle_id", where.cycleId) : q.eq("id", where.attemptId);
  const { data } = await q;
  const now = new Date().toISOString();
  for (const a of data ?? []) {
    await admin
      .from("bingo_attempts")
      .update({ status: (a.required_filled as number) >= campaign.duration_days ? "completed" : "finished", finalized_at: now })
      .eq("id", a.id)
      .eq("status", "active");
  }
}

/**
 * The cron's job: set up cycles that start soon, end cycles that are over,
 * and keep one upcoming cycle queued for automatic Bingos — so there's
 * always a next one to join while the current one runs.
 */
export async function runBingoScheduler(admin: Admin) {
  const log: string[] = [];
  const now = Date.now();

  const { data: auto } = await admin
    .from("bingo_campaigns")
    .select("*")
    .eq("status", "live")
    .eq("enrollment", "fixed")
    .eq("recurrence", "automatic");
  for (const c of (auto ?? []) as BingoCampaignRow[]) {
    const { data: last } = await admin
      .from("bingo_cycles")
      .select("ends_at")
      .eq("campaign_id", c.id)
      .neq("status", "cancelled")
      .order("cycle_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    // Queue the next cycle once the latest one has started.
    const lastEnds = last ? Date.parse(last.ends_at as string) : null;
    if (lastEnds != null && lastEnds - c.duration_days * DAY_MS <= now) {
      try {
        // Back-to-back; after a pause, from the next midnight instead.
        const next = await createCycle(admin, c, lastEnds > now ? new Date(lastEnds) : nextLagosMidnight(now));
        log.push(`queued ${c.slug} #${next.cycle_number}`);
      } catch (err) {
        log.push(`queue ${c.slug} failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  const { data: due } = await admin
    .from("bingo_cycles")
    .select("id, campaign_id, status, starts_at, bingo_campaigns!inner(status, slug)")
    .in("status", ["scheduled", "failed"])
    .lte("starts_at", new Date(now + SETUP_AHEAD_MS).toISOString());
  for (const cy of due ?? []) {
    const camp = (Array.isArray(cy.bingo_campaigns) ? cy.bingo_campaigns[0] : cy.bingo_campaigns) as { status: string; slug: string };
    if (camp.status !== "live") continue;
    const r = await setupCycle(admin, cy.id as string);
    log.push(`setup ${camp.slug}: ${r.ok ? "ready" : r.error}`);
  }

  const { data: over } = await admin
    .from("bingo_cycles")
    .select("id")
    .eq("status", "ready")
    .lte("ends_at", new Date(now).toISOString());
  for (const cy of over ?? []) {
    const r = await endCycle(admin, cy.id as string);
    log.push(`end ${cy.id}: ${r.ok ? "archived" : r.error}`);
  }
  // Rolling cards: close the ones that ran out or missed a day (the stake
  // itself is settled by the Forfeit deadline keeper, like any personal goal).
  const { data: rolling } = await admin
    .from("bingo_attempts")
    .select("id, started_at, ends_at, required_filled, bingo_campaigns!inner(*)")
    .is("cycle_id", null)
    .eq("status", "active")
    .lte("started_at", new Date(now - DAY_MS).toISOString());
  let closed = 0;
  for (const a of rolling ?? []) {
    const camp = (Array.isArray(a.bingo_campaigns) ? a.bingo_campaigns[0] : a.bingo_campaigns) as BingoCampaignRow;
    if (rollingAttemptOver(a as { started_at: string; ends_at: string; required_filled: number }, camp.duration_days, now)) {
      await finalizeAttempts(admin, camp, { attemptId: a.id as string });
      closed++;
    }
  }
  if (closed) log.push(`closed ${closed} rolling cards`);
  return log;
}
