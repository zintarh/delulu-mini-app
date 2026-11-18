/**
 * Referral rounds — the single switch for referrals.
 *
 * Referrals run in weekly rounds, two per 2-week epoch. Each round has a
 * reward per referral and a number of spots (set from the admin): once a
 * round's spots are taken, no more referrals are credited until the next
 * round (evaluate.ts). Friends who qualify while it's full are credited when
 * the next round opens, first come first served. Outside every round nothing is credited and the invite link
 * is hidden; sign-ups through a link keep working, they just earn nothing.
 *
 * Only friends who signed up on/after the first round's start count (no
 * leftovers from the old Sep campaign). A credit is paid at the reward of the
 * round it was earned in — also after that round ends (payout.ts).
 *
 * To plan the next epoch: add its two rounds below (Lagos midnights) and deploy.
 *
 * Shared by server (evaluate/payout/gift) and client (Rewards card,
 * /referrals), so keep it free of server-only imports.
 */
export type ReferralRound = {
  /** Inclusive start, Lagos midnight. */
  start: string;
  /** Exclusive end, Lagos midnight (7 days later). */
  end: string;
  /** G$ per counted referral in this round, in total (what the app advertises). */
  reward: number;
  /**
   * Paid when the friend qualifies; the rest of `reward` follows once they've
   * shown up 3 days in a row (lib/referral/streak.ts). Unset = all at once.
   */
  firstPayment?: number;
  /** Total G$ this round may pay out (reward × referrals). */
  budget: number;
  /**
   * Referral spots this round — how many friends can be credited. The admin
   * can change it per round (referral_round_slots, lib/referral/slots.ts);
   * this is the default when they haven't.
   */
  slots?: number;
};

/**
 * GoodBuilders Season 2: six 2-week epochs from Tue 17 Nov 2026, each ending on
 * a Tuesday demo day (1 Dec, 15 Dec, 29 Dec, 12 Jan, 26 Jan, 9 Feb). Referrals
 * run weekly inside them — two rounds per epoch, Tuesday to Tuesday (Lagos
 * midnight). 5,000 G$ per friend: 2,000 when they qualify + 3,000 after 3 days
 * in a row. Spots per round are set from the admin; `slots` is the default.
 */
export const SEASON_START_LAGOS = "2026-11-17";
export const EPOCH_COUNT = 6;

const lagosMidnightIso = (dateUtcMs: number) => `${new Date(dateUtcMs).toISOString().slice(0, 10)}T00:00:00+01:00`;
const seasonDay = (days: number) => Date.parse(`${SEASON_START_LAGOS}T00:00:00Z`) + days * 86_400_000;

export const REFERRAL_ROUNDS: ReferralRound[] = Array.from({ length: EPOCH_COUNT * 2 }, (_, i) => ({
  start: lagosMidnightIso(seasonDay(i * 7)),
  end: lagosMidnightIso(seasonDay((i + 1) * 7)),
  reward: 5000,
  firstPayment: 2000,
  budget: 50_000,
  slots: 10,
}));

/** The six epochs: two referral rounds each, ending on demo day. */
export type SeasonEpoch = { number: number; start: string; end: string; demoDay: string; rounds: [ReferralRound, ReferralRound] };
export const SEASON_EPOCHS: SeasonEpoch[] = Array.from({ length: EPOCH_COUNT }, (_, e) => ({
  number: e + 1,
  start: REFERRAL_ROUNDS[e * 2].start,
  end: REFERRAL_ROUNDS[e * 2 + 1].end,
  demoDay: REFERRAL_ROUNDS[e * 2 + 1].end.slice(0, 10),
  rounds: [REFERRAL_ROUNDS[e * 2], REFERRAL_ROUNDS[e * 2 + 1]],
}));

/** Previous programme (Sep 11 → 29 2026, 6,000 G$ each) is closed for good. */
const SERIES_START_MS = Math.min(...REFERRAL_ROUNDS.map((r) => Date.parse(r.start)));

/** The round running at `now`, if any. */
export function currentReferralRound(now: Date = new Date()): ReferralRound | null {
  const t = now.getTime();
  return REFERRAL_ROUNDS.find((r) => t >= Date.parse(r.start) && t < Date.parse(r.end)) ?? null;
}

/** The round a timestamp (a credit) falls in, if any. */
export function referralRoundAt(iso: string | null | undefined): ReferralRound | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return REFERRAL_ROUNDS.find((r) => t >= Date.parse(r.start) && t < Date.parse(r.end)) ?? null;
}

/** What the first payment is (the rest is the 3-day bonus). */
export function roundFirstPayment(round: ReferralRound): number {
  return Math.min(round.reward, round.firstPayment ?? round.reward);
}

/** Max referrals a round can pay (budget ÷ reward). */
export function roundCapacity(round: ReferralRound): number {
  if (typeof round.slots === "number") return round.slots;
  return round.reward > 0 ? Math.floor(round.budget / round.reward) : 0;
}

/** Reward per referral right now (or the next/last round's, for copy shown between rounds). */
export function referralRewardNow(now: Date = new Date()): number {
  const t = now.getTime();
  const next = REFERRAL_ROUNDS.find((r) => Date.parse(r.end) > t);
  return (currentReferralRound(now) ?? next ?? REFERRAL_ROUNDS[REFERRAL_ROUNDS.length - 1]).reward;
}

/** @deprecated Use referralRewardNow() — rounds can pay different amounts. */
export const REFERRAL_GDOLLARS_REWARD = referralRewardNow();

/** Referrals are being credited right now. */
export function isReferralCampaignLive(now: Date = new Date()): boolean {
  return currentReferralRound(now) != null;
}

/** No round running — between rounds or after the last one. */
export function isReferralCampaignOver(now: Date = new Date()): boolean {
  return !isReferralCampaignLive(now);
}

/** Whether a timestamp (sign-up, credit) is within the round-based programme. */
export function isInCurrentReferralCampaign(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= SERIES_START_MS;
}

/** When the running round ends: "today" / "tomorrow" / "Nov 24" (its last day, WAT). */
export function referralCampaignEndLabel(now: Date = new Date()): string {
  const round = currentReferralRound(now) ?? REFERRAL_ROUNDS[REFERRAL_ROUNDS.length - 1];
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(d);
  const lastDay = new Date(Date.parse(round.end) - 1);
  if (day(now) === day(lastDay)) return "today";
  if (day(new Date(now.getTime() + 24 * 60 * 60 * 1000)) === day(lastDay)) return "tomorrow";
  return new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Lagos", month: "short", day: "numeric" }).format(lastDay);
}

/** The next round that hasn't started yet, if any. */
export function nextReferralRound(now: Date = new Date()): ReferralRound | null {
  const t = now.getTime();
  return REFERRAL_ROUNDS.find((r) => Date.parse(r.start) > t) ?? null;
}

/**
 * Where referrals stand: "live" (link works), "soon" (announced — everything
 * visible, link opens at the round start), or "off".
 */
export type ReferralPhase = { phase: "live"; round: ReferralRound } | { phase: "soon"; round: ReferralRound } | { phase: "off" };

/** How far ahead an upcoming round is announced. */
const ANNOUNCE_MS = 36 * 60 * 60 * 1000;

export function referralPhase(now: Date = new Date()): ReferralPhase {
  const live = currentReferralRound(now);
  if (live) return { phase: "live", round: live };
  const next = nextReferralRound(now);
  if (next && Date.parse(next.start) - now.getTime() <= ANNOUNCE_MS) return { phase: "soon", round: next };
  return { phase: "off" };
}

/** "tomorrow" / "today" / "Wed 25 Nov" for when a round opens (Lagos time). */
export function referralOpensLabel(round: ReferralRound, now: Date = new Date()): string {
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(d);
  const start = new Date(round.start);
  if (day(now) === day(start)) return "today";
  if (day(new Date(now.getTime() + 24 * 60 * 60 * 1000)) === day(start)) return "tomorrow";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" }).format(start);
}
