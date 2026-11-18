import type { getSupabaseAdmin } from "@/lib/push/supabase";
import {
  DEFAULT_EPOCH_CIRCULATION_TARGET,
  SEASON_EPOCHS,
  WEEK2_RETENTION_TARGET,
  type ReferralRound,
} from "@/lib/referral/campaign";
import { FIRST_WEEK_SLUG } from "@/lib/bingo/first-week";
import { fetchGStakesSince } from "@/lib/community/campaign-subgraph";
import { loadActivity } from "@/lib/analytics/retention";
import { roundSlots } from "@/lib/referral/slots";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const DAY = 86_400_000;

/** One week (or a whole epoch) of the season: targets next to what happened. */
export type SeasonPeriod = {
  start: string;
  end: string;
  status: "done" | "live" | "upcoming";
  // Acquisition
  signups: number;
  referredSignups: number;
  referralsCredited: number;
  spotsTarget: number;
  // Retention
  keptOneDay: number;
  /** Signed up in the period and kept a day 7–13 days later (null until measurable). */
  stillHereWeek2: number | null;
  retentionTarget: number;
  activePlayers: number;
  // Finishing
  finishedCards: number;
  finishedFirstWeek: number;
  // G$ circulation
  gStaked: number;
  gPaidOut: number;
  gCirculation: number;
  circulationTarget: number;
};

export type SeasonEpochReport = SeasonPeriod & { number: number; demoDay: string; weeks: SeasonPeriod[] };

export type SeasonReport = { generatedAt: string; epochs: SeasonEpochReport[] };

const within = (ms: number, start: string, end: string) => ms >= Date.parse(start) && ms < Date.parse(end);

async function circulationTargets(admin: Admin): Promise<Map<number, number>> {
  const { data, error } = await admin.from("season_epoch_targets").select("epoch, circulation_target");
  return new Map(error ? [] : (data ?? []).map((r) => [Number(r.epoch), Number(r.circulation_target)]));
}

/**
 * Everything the Season dashboard shows, from real records: profiles (sign-ups,
 * referred), referral credits (spots used), verified proofs on-chain + AI-approved
 * photos (retention, active), Bingo attempts (finishers), stakes on-chain and
 * payouts (G$ circulation = staked + paid out).
 */
export async function loadSeasonReport(admin: Admin, nowMs = Date.now()): Promise<SeasonReport> {
  const seasonStart = Date.parse(SEASON_EPOCHS[0].start);
  const sinceIso = new Date(seasonStart).toISOString();
  const [activity, stakes, profiles, credits, rewards, referralPaid, streakPaid, gifts, attempts, targets] = await Promise.all([
    loadActivity(admin, seasonStart),
    fetchGStakesSince(Math.floor(seasonStart / 1000)).catch(() => [] as [number, number][]),
    admin.from("profiles").select("address, created_at, referred_by").gte("created_at", sinceIso).limit(50_000),
    admin.from("referral_credits").select("credited_at").gte("credited_at", sinceIso).limit(50_000),
    admin.from("reward_payouts").select("amount, status, updated_at").eq("status", "confirmed").gte("updated_at", sinceIso).limit(100_000),
    admin.from("referral_credits").select("gdollars_amount, paid_at").eq("payout_status", "sent").gte("paid_at", sinceIso).limit(50_000),
    admin.from("referral_credits").select("streak_amount, streak_paid_at").eq("streak_status", "sent").gte("streak_paid_at", sinceIso).limit(50_000),
    admin.from("profiles").select("onboarding_gift_claimed_at").eq("onboarding_gift_status", "sent").gte("onboarding_gift_claimed_at", sinceIso).limit(50_000),
    admin.from("bingo_attempts").select("required_filled, ends_at, bingo_campaigns!inner(slug, duration_days)").gte("ends_at", sinceIso).limit(50_000),
    circulationTargets(admin),
  ]);

  const signups = (profiles.data ?? []).map((p) => ({
    wallet: String(p.address).toLowerCase(),
    at: Date.parse(String(p.created_at)),
    referred: !!p.referred_by,
  }));
  const payouts: [number, number][] = [
    ...(rewards.data ?? []).map((r) => [Date.parse(String(r.updated_at)), Number(r.amount)] as [number, number]),
    ...(referralPaid.data ?? []).map((r) => [Date.parse(String(r.paid_at)), Number(r.gdollars_amount ?? 0)] as [number, number]),
    // Before the streak migration ran this query errors and simply adds nothing.
    ...((streakPaid.error ? [] : streakPaid.data) ?? []).map((r) => [Date.parse(String(r.streak_paid_at)), Number(r.streak_amount ?? 0)] as [number, number]),
    ...(gifts.data ?? []).map((g) => [Date.parse(String(g.onboarding_gift_claimed_at)), 1000] as [number, number]),
  ];
  type Attempt = { required_filled: number; ends_at: string; bingo_campaigns: { slug: string; duration_days: number } | { slug: string; duration_days: number }[] };
  const finished = ((attempts.data ?? []) as unknown as Attempt[])
    .map((a) => ({ a, c: Array.isArray(a.bingo_campaigns) ? a.bingo_campaigns[0] : a.bingo_campaigns }))
    .filter(({ a, c }) => a.required_filled >= c.duration_days)
    .map(({ a, c }) => ({ at: Date.parse(a.ends_at), firstWeek: c.slug === FIRST_WEEK_SLUG }));

  const period = (start: string, end: string, spotsTarget: number, circulationTarget: number): SeasonPeriod => {
    const status = nowMs >= Date.parse(end) ? "done" : nowMs >= Date.parse(start) ? "live" : "upcoming";
    const cohort = signups.filter((s) => within(s.at, start, end));
    const measurable = nowMs >= Date.parse(end) + 14 * DAY;
    let kept = 0;
    let week2 = 0;
    for (const s of cohort) {
      const ts = activity.get(s.wallet) ?? [];
      if (ts.some((t) => t >= s.at)) kept++;
      if (ts.some((t) => t >= s.at + 7 * DAY && t < s.at + 14 * DAY)) week2++;
    }
    const gStaked = Math.round(stakes.filter(([t]) => within(t, start, end)).reduce((n, [, g]) => n + g, 0));
    const gPaidOut = Math.round(payouts.filter(([t]) => within(t, start, end)).reduce((n, [, g]) => n + g, 0));
    return {
      start,
      end,
      status,
      signups: cohort.length,
      referredSignups: cohort.filter((s) => s.referred).length,
      referralsCredited: (credits.data ?? []).filter((c) => within(Date.parse(String(c.credited_at)), start, end)).length,
      spotsTarget,
      keptOneDay: kept,
      stillHereWeek2: measurable ? week2 : null,
      retentionTarget: WEEK2_RETENTION_TARGET,
      activePlayers: [...activity.values()].filter((ts) => ts.some((t) => within(t, start, end))).length,
      finishedCards: finished.filter((f) => within(f.at, start, end)).length,
      finishedFirstWeek: finished.filter((f) => f.firstWeek && within(f.at, start, end)).length,
      gStaked,
      gPaidOut,
      gCirculation: gStaked + gPaidOut,
      circulationTarget,
    };
  };

  const epochs: SeasonEpochReport[] = [];
  for (const e of SEASON_EPOCHS) {
    const spots = await Promise.all(e.rounds.map((r: ReferralRound) => roundSlots(admin, r)));
    const circTarget = targets.get(e.number) ?? DEFAULT_EPOCH_CIRCULATION_TARGET;
    const weeks = e.rounds.map((r, i) => period(r.start, r.end, spots[i], Math.round(circTarget / 2)));
    epochs.push({ ...period(e.start, e.end, spots[0] + spots[1], circTarget), number: e.number, demoDay: e.demoDay, weeks });
  }
  return { generatedAt: new Date(nowMs).toISOString(), epochs };
}
