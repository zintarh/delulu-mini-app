import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { REFERRAL_ROUNDS, currentReferralRound, nextReferralRound, roundCapacity, type ReferralRound } from "@/lib/referral/campaign";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * Referral spots: how many friends a round can credit. The admin sets it per
 * round (referral_round_slots); otherwise the round's default from campaign.ts.
 * "Used" = referral credits created inside the round.
 */
export type SlotsView = {
  live: boolean;
  start: string | null;
  end: string | null;
  slots: number;
  used: number;
  left: number;
  /** When the next round (fresh spots) opens. */
  nextStart: string | null;
  reward: number;
};

const CACHE_MS = 30_000;
let cache: { at: number; overrides: Map<string, number> } | null = null;

async function overrides(admin: Admin): Promise<Map<string, number>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.overrides;
  const { data, error } = await admin.from("referral_round_slots").select("round_start, slots");
  // Before the migration runs there's no table — the defaults apply.
  const map = new Map<string, number>(error ? [] : (data ?? []).map((r) => [String(r.round_start), Number(r.slots)]));
  cache = { at: Date.now(), overrides: map };
  return map;
}

export function invalidateSlotsCache() {
  cache = null;
}

export async function roundSlots(admin: Admin, round: ReferralRound): Promise<number> {
  return (await overrides(admin)).get(round.start) ?? roundCapacity(round);
}

export async function roundUsed(admin: Admin, round: ReferralRound): Promise<number> {
  const { count } = await admin
    .from("referral_credits")
    .select("id", { count: "exact", head: true })
    .gte("credited_at", new Date(round.start).toISOString())
    .lt("credited_at", new Date(round.end).toISOString());
  return count ?? 0;
}

export async function slotsView(admin: Admin, now = new Date()): Promise<SlotsView> {
  const round = currentReferralRound(now);
  const next = nextReferralRound(now);
  if (!round) return { live: false, start: null, end: null, slots: 0, used: 0, left: 0, nextStart: next?.start ?? null, reward: next?.reward ?? 0 };
  const [slots, used] = await Promise.all([roundSlots(admin, round), roundUsed(admin, round)]);
  return { live: true, start: round.start, end: round.end, slots, used, left: Math.max(0, slots - used), nextStart: next?.start ?? null, reward: round.reward };
}

/** Every round with its spots and how many are taken — the admin's view. */
export async function allRoundSlots(admin: Admin) {
  return Promise.all(
    REFERRAL_ROUNDS.map(async (r) => ({
      start: r.start,
      end: r.end,
      reward: r.reward,
      defaultSlots: roundCapacity(r),
      slots: await roundSlots(admin, r),
      used: await roundUsed(admin, r),
    })),
  );
}
