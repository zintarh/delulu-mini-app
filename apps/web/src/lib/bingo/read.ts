import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { loadRewardsConfig } from "@/lib/rewards/config";
import { completionAmountFor, isCategoryEnabled } from "@/lib/rewards/rules";
import { loadSquares } from "@/lib/bingo/attempts";
import { perSquareFor } from "@/lib/bingo/reward";
import { buildSquares, type BingoCardView, type BingoView } from "@/lib/bingo/view";
export type { BingoCardView, BingoSquareView, BingoTierView, BingoView } from "@/lib/bingo/view";
import {
  DAY_MS,
  cyclePhase,
  daySlot,
  isBonusTier,
  rollingAttemptOver,
  rollingMissedDay,
  type BingoAttemptRow,
  type BingoCampaignRow,
  type BingoCycleRow,
  type BingoCycleTierRow,
  type BingoMission,
  type BingoVersionRow,
} from "@/lib/bingo/types";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Bingos are announced the day before they start — a later cycle stays out of sight until then. */
export const ANNOUNCE_AHEAD_MS = DAY_MS;
export function announced(cycle: { starts_at: string }, nowMs = Date.now()) {
  return Date.parse(cycle.starts_at) - nowMs <= ANNOUNCE_AHEAD_MS;
}

export async function profilesFor(admin: Admin, wallets: string[]) {
  if (wallets.length === 0) return new Map<string, { username: string | null; avatar: string | null }>();
  const { data } = await admin.from("profiles").select("address, username, pfp_url").in("address", wallets);
  return new Map(
    (data ?? []).map((p) => [String(p.address).toLowerCase(), { username: (p.username as string) ?? null, avatar: (p.pfp_url as string) ?? null }]),
  );
}

/** Is this attempt's card closed for good (cycle over, finalised, or a rolling day missed)? */
function attemptClosed(a: BingoAttemptRow, durationDays: number, cycleOver: boolean, nowMs = Date.now()) {
  if (a.status !== "active") return true;
  if (a.cycle_id == null) return rollingAttemptOver(a, durationDays, nowMs);
  return cycleOver;
}

export async function cardViews(
  admin: Admin,
  attempts: BingoAttemptRow[],
  missions: BingoMission[],
  tiers: { tier_key: string; label: string }[],
  opts: { cycleOver: boolean; viewer?: string | null; durationDays: number },
): Promise<BingoCardView[]> {
  const [squares, profiles] = await Promise.all([
    loadSquares(admin, attempts.map((a) => a.id)),
    profilesFor(admin, attempts.map((a) => a.wallet)),
  ]);
  const tierLabel = new Map(tiers.map((t) => [t.tier_key, t.label]));
  return attempts.map((a) => {
    const own = opts.viewer === a.wallet;
    // Other players only ever see approved, on-chain squares.
    const visible = (squares.get(a.id) ?? []).filter((s) => own || s.status === "filled");
    const p = profiles.get(a.wallet);
    return {
      attemptId: a.id,
      wallet: a.wallet,
      username: p?.username ?? null,
      avatarUrl: p?.avatar ?? null,
      tierKey: a.tier_key,
      tierLabel: tierLabel.get(a.tier_key) ?? a.tier_key,
      stake: Number(a.stake_amount),
      status: a.status,
      squaresFilled: a.squares_filled,
      requiredFilled: a.required_filled,
      lastFilledAt: a.last_filled_at,
      startedAt: a.started_at,
      endsAt: a.ends_at,
      squares: buildSquares(missions, visible, attemptClosed(a, opts.durationDays, opts.cycleOver)),
    };
  });
}

/** Pick the cycle to show from all of a campaign's cycles (one query instead of two). */
function pickCycle(cycles: BingoCycleRow[], nowMs = Date.now()): BingoCycleRow | null {
  const live = cycles
    .filter((c) => ["scheduled", "setting_up", "ready", "failed", "ending"].includes(c.status) && Date.parse(c.ends_at) > nowMs)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  if (live[0]) return live[0];
  return [...cycles].filter((c) => c.status !== "cancelled").sort((a, b) => b.cycle_number - a.cycle_number)[0] ?? null;
}

/** The viewer's own card in one query: squares (pending ones included) + today's state from them. */
async function myCard(
  admin: Admin,
  a: BingoAttemptRow,
  missions: BingoMission[],
  tierLabel: string,
  window: { startsAt: string; endsAt: string; cycleOver: boolean },
  durationDays: number,
) {
  const rows = (await loadSquares(admin, [a.id])).get(a.id) ?? [];
  const today = daySlot(window.startsAt, window.endsAt);
  const todayUsed = today != null && rows.some((r) => r.slot_index === today && r.status === "filled");
  const phase = cyclePhase({ starts_at: window.startsAt, ends_at: window.endsAt });
  const nextSquareAt =
    phase === "upcoming"
      ? window.startsAt
      : today != null && todayUsed && today + 1 < durationDays
        ? new Date(Date.parse(window.startsAt) + (today + 1) * DAY_MS).toISOString()
        : null;
  const card: BingoCardView = {
    attemptId: a.id,
    wallet: a.wallet,
    username: null,
    avatarUrl: null,
    tierKey: a.tier_key,
    tierLabel,
    stake: Number(a.stake_amount),
    status: a.status,
    squaresFilled: a.squares_filled,
    requiredFilled: a.required_filled,
    lastFilledAt: a.last_filled_at,
    startedAt: a.started_at,
    endsAt: a.ends_at,
    squares: buildSquares(missions, rows, attemptClosed(a, durationDays, window.cycleOver)),
  };
  return { card, phase, today, todayUsed, nextSquareAt };
}

/**
 * Everything one Bingo card on screen needs, in three parallel rounds:
 * (cycles, version, config, rolling stats) → (tiers, players, my attempt) → my squares.
 */
export async function buildBingoView(admin: Admin, campaign: BingoCampaignRow, viewer: string | null): Promise<BingoView | null> {
  const rolling = campaign.enrollment === "rolling";
  const nowIso = new Date().toISOString();
  const [cyclesRes, currentVersionRes, config, rollingCount, rollingMine] = await Promise.all([
    rolling ? Promise.resolve({ data: [] }) : admin.from("bingo_cycles").select("*").eq("campaign_id", campaign.id),
    campaign.current_version_id
      ? admin.from("bingo_versions").select("*").eq("id", campaign.current_version_id).maybeSingle()
      : Promise.resolve({ data: null }),
    loadRewardsConfig(admin),
    rolling
      ? admin
          .from("bingo_attempts")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .is("cycle_id", null)
          .gt("ends_at", nowIso)
      : Promise.resolve({ count: 0 }),
    rolling && viewer
      ? admin
          .from("bingo_attempts")
          .select("*")
          .eq("campaign_id", campaign.id)
          .is("cycle_id", null)
          .eq("wallet", viewer)
          .order("started_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [] }),
  ]);
  const cycle = rolling ? null : pickCycle((cyclesRes.data ?? []) as BingoCycleRow[]);
  const live = campaign.status === "live";

  let tiers: BingoCycleTierRow[] = [];
  let players = 0;
  let me: BingoView["me"] = null;
  let joinable = false;
  let v = currentVersionRes.data as BingoVersionRow | null;

  if (rolling) {
    if (!v) return null;
    players = (rollingCount as { count: number | null }).count ?? 0;
    const mine = ((rollingMine as { data: unknown[] | null }).data?.[0] as BingoAttemptRow | undefined) ?? null;
    const mineOver = mine ? attemptClosed(mine, campaign.duration_days, false) : true;
    // Show the last attempt for a day after it ends (results), then move on.
    if (mine && (!mineOver || Date.now() - Date.parse(mine.ends_at) < DAY_MS)) {
      const label = v.tiers.find((t) => t.key === mine.tier_key)?.label ?? mine.tier_key;
      const r = await myCard(admin, mine, v.missions, label, { startsAt: mine.started_at, endsAt: mine.ends_at, cycleOver: false }, campaign.duration_days);
      const missedDay = mine.required_filled < campaign.duration_days && rollingMissedDay(mine);
      me = { ...r.card, phase: mineOver ? "ended" : r.phase, today: r.today, todayUsed: r.todayUsed, nextSquareAt: r.nextSquareAt, dayOrdered: true, missedDay };
    }
    // One-time rolling Bingos (My First 3) are an onboarding card: one per wallet, ever.
    joinable = live && mineOver && !(campaign.recurrence === "one_time" && mine);
  } else if (cycle) {
    const [{ data: t }, { count }, mineRes, cycleVersion] = await Promise.all([
      admin.from("bingo_cycle_tiers").select("*").eq("cycle_id", cycle.id).order("sort_order"),
      admin.from("bingo_attempts").select("id", { count: "exact", head: true }).eq("cycle_id", cycle.id),
      viewer
        ? admin.from("bingo_attempts").select("*").eq("cycle_id", cycle.id).eq("wallet", viewer).maybeSingle()
        : Promise.resolve({ data: null }),
      // A running cycle keeps the version it started on, even after an edit.
      v && v.id === cycle.version_id ? Promise.resolve({ data: v }) : admin.from("bingo_versions").select("*").eq("id", cycle.version_id).maybeSingle(),
    ]);
    v = cycleVersion.data as BingoVersionRow | null;
    if (!v) return null;
    tiers = (t ?? []) as BingoCycleTierRow[];
    players = count ?? 0;
    const mine = mineRes.data as BingoAttemptRow | null;
    if (mine) {
      const label = tiers.find((x) => x.tier_key === mine.tier_key)?.label ?? mine.tier_key;
      const r = await myCard(admin, mine, v.missions, label, { startsAt: cycle.starts_at, endsAt: cycle.ends_at, cycleOver: cyclePhase(cycle) === "ended" }, campaign.duration_days);
      me = { ...r.card, phase: r.phase, today: r.today, todayUsed: r.todayUsed, nextSquareAt: r.nextSquareAt, dayOrdered: false, missedDay: false };
    }
    // Join until the last day starts — a later joiner couldn't fill a single required square.
    const allReady = tiers.length > 0 && tiers.every((x) => x.setup_step === "ready");
    joinable = live && !me && cycle.status === "ready" && allReady && announced(cycle) && Date.now() < Date.parse(cycle.ends_at) - DAY_MS;
  } else if (!v) {
    return null;
  }
  const photos: string[] = [];

  const completionTiers = rolling ? config.goalCompletion : config.campaignCompletion;
  return {
    id: campaign.id,
    slug: campaign.slug,
    title: campaign.title,
    description: campaign.description,
    coverImageUrl: campaign.cover_image_url,
    durationDays: campaign.duration_days,
    enrollment: campaign.enrollment,
    recurrence: campaign.recurrence,
    missions: v.missions,
    cycle: cycle
      ? {
          id: cycle.id,
          number: cycle.cycle_number,
          startsAt: cycle.starts_at,
          endsAt: cycle.ends_at,
          phase: cyclePhase(cycle),
          today: daySlot(cycle.starts_at, cycle.ends_at),
          joinable,
          joinClosesAt: new Date(Date.parse(cycle.ends_at) - DAY_MS).toISOString(),
        }
      : null,
    // Bonus squares' free campaigns are plumbing, not stakes to pick.
    tiers:
      tiers.length > 0
        ? tiers.filter((t) => !isBonusTier(t.tier_key)).map((t) => ({
            key: t.tier_key,
            label: t.label,
            stake: Number(t.stake_amount),
            forfeitPct: t.forfeit_pct,
            campaignId: t.community_campaign_id,
            challengeId: t.on_chain_challenge_id,
            ready: t.setup_step === "ready",
          }))
        : v.tiers.map((t) => ({ key: t.key, label: t.label, stake: t.stake, forfeitPct: t.forfeitPct, campaignId: null, challengeId: null, ready: rolling })),
    joinable,
    visible: rolling || !!me || (cycle != null && cyclePhase(cycle) !== "ended" && announced(cycle)),
    players,
    photos,
    rewards: {
      perProof: isCategoryEnabled(config, "daily_proof") ? perSquareFor(v.tiers, me?.tierKey ?? null, config.dailyProof.amount) : 0,
      completion:
        isCategoryEnabled(config, rolling ? "goal_completion" : "campaign_completion")
          ? completionAmountFor(campaign.duration_days, completionTiers.tiers)
          : 0,
    },
    me,
  };
}
