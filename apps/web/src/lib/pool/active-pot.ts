import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { reserveReward, processPayout } from "@/lib/rewards/ledger";
import { engineRewardId } from "@/lib/celo/reward-vault-payout";
import { addDays, weekBounds } from "@/lib/rewards/rules";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * The Weekly Active Pot (25 Nov 2026): everyone who keeps a photo on a
 * STAKED card every Lagos day Monday–Sunday shares ~$100 of G$ a week.
 * Shares are TICKETS that grow with the stake (TICKETS below) — steep from
 * 100 to 1,000, flatter above, so new players are pushed to 1,000 and whales
 * can't swallow the pot — and new players (first 14 days) get double tickets.
 * Funded from the marketing budget (later also 80% of missed stakes).
 */
import { ACTIVE_POT, ticketsFor } from "@/lib/pool/tickets";
export { ACTIVE_POT, TICKETS, ticketsFor } from "@/lib/pool/tickets";

const DAY = 86_400_000;
/** Lagos calendar day (UTC+1, no DST). */
export const lagosDay = (ms: number) => new Date(ms + 3_600_000).toISOString().slice(0, 10);
const lagosMidnightIso = (day: string) => `${day}T00:00:00+01:00`;

export type PotPlayer = {
  wallet: string;
  /** Lagos days (YYYY-MM-DD) this week with a kept photo on a staked card. */
  days: string[];
  /** Biggest stake they had on a card this week (G$), capped. */
  stake: number;
  newcomer: boolean;
};

export type PotWeek = {
  start: string;
  end: string;
  potG: number;
  players: PotPlayer[];
};

async function inChunks<T>(items: string[], fn: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < items.length; i += 200) out.push(...(await fn(items.slice(i, i + 200))));
  return out;
}

/** Who kept which days on a staked card in the Mon–Sun week starting `start`. */
export async function loadPotWeek(admin: Admin, start: string): Promise<PotWeek> {
  const { end } = weekBounds(start);
  const from = lagosMidnightIso(start);
  const to = lagosMidnightIso(addDays(end, 1));

  const [squares, periods] = await Promise.all([
    admin
      .from("bingo_squares")
      .select("filled_at, bingo_attempts!inner(wallet, stake_amount)")
      .eq("status", "filled")
      .gte("filled_at", from)
      .lt("filled_at", to)
      .gt("bingo_attempts.stake_amount", 0)
      .limit(50_000),
    admin
      .from("forfeit_periods")
      .select("resolved_at, forfeit_commitments!inner(creator_wallet, stake_amount_wei)")
      .eq("verifier_action", "approved")
      .gte("resolved_at", from)
      .lt("resolved_at", to)
      .limit(50_000),
  ]);

  const byWallet = new Map<string, { days: Set<string>; stake: number }>();
  const add = (wallet: string, atIso: string, stake: number) => {
    if (!(stake > 0)) return;
    const w = wallet.toLowerCase();
    const cur = byWallet.get(w) ?? { days: new Set<string>(), stake: 0 };
    cur.days.add(lagosDay(Date.parse(atIso)));
    cur.stake = Math.max(cur.stake, stake);
    byWallet.set(w, cur);
  };
  type Sq = { filled_at: string; bingo_attempts: { wallet: string; stake_amount: number } | { wallet: string; stake_amount: number }[] };
  for (const s of (squares.data ?? []) as unknown as Sq[]) {
    const a = Array.isArray(s.bingo_attempts) ? s.bingo_attempts[0] : s.bingo_attempts;
    add(a.wallet, s.filled_at, Number(a.stake_amount));
  }
  type Pe = { resolved_at: string; forfeit_commitments: { creator_wallet: string; stake_amount_wei: string | null } | { creator_wallet: string; stake_amount_wei: string | null }[] };
  for (const p of (periods.data ?? []) as unknown as Pe[]) {
    const c = Array.isArray(p.forfeit_commitments) ? p.forfeit_commitments[0] : p.forfeit_commitments;
    let g = 0;
    try {
      g = Number(BigInt(String(c.stake_amount_wei ?? "0")) / 10n ** 18n);
    } catch {
      g = 0;
    }
    add(c.creator_wallet, p.resolved_at, g);
  }

  // Newcomers: joined within 14 days of the week's end.
  const wallets = [...byWallet.keys()];
  const profiles = await inChunks(wallets, async (chunk) => {
    const { data } = await admin.from("profiles").select("address, created_at").in("address", chunk);
    return (data ?? []) as { address: string; created_at: string | null }[];
  });
  const joined = new Map(profiles.map((p) => [String(p.address).toLowerCase(), p.created_at ? Date.parse(p.created_at) : null]));
  const endMs = Date.parse(to);

  return {
    start,
    end,
    potG: ACTIVE_POT.weeklyG,
    players: wallets.map((w) => {
      const v = byWallet.get(w)!;
      const at = joined.get(w) ?? null;
      return {
        wallet: w,
        days: [...v.days].sort(),
        stake: Math.min(ACTIVE_POT.stakeCap, v.stake),
        newcomer: at != null && endMs - at <= ACTIVE_POT.newcomerDays * DAY,
      };
    }),
  };
}

/** Pure: each qualifier's share of the pot (whole G$). `daysNeeded` = the week's days so far (7 once it's over). */
export function potShares(week: Pick<PotWeek, "potG" | "players">, daysNeeded: number): Map<string, number> {
  const q = week.players.filter((p) => p.days.length >= daysNeeded && ticketsFor(p.stake, p.newcomer) > 0);
  const out = new Map<string, number>();
  const total = q.reduce((n, p) => n + ticketsFor(p.stake, p.newcomer), 0);
  if (!total) return out;
  for (const p of q) out.set(p.wallet, Math.floor((week.potG * ticketsFor(p.stake, p.newcomer)) / total));
  return out;
}

/** This week so far, for the Home card: pot, players still on track, and this wallet's standing. */
export async function currentPot(admin: Admin, wallet: string | null, nowMs = Date.now()) {
  const today = lagosDay(nowMs);
  const { start, end } = weekBounds(today);
  const week = await loadPotWeek(admin, start);
  // "On track" = kept every day so far (today counts once it's kept; until then, yesterday's run).
  const daysSoFar = Math.round((Date.parse(today) - Date.parse(start)) / DAY) + 1;
  const keptToday = (p: PotPlayer) => p.days.includes(today);
  const onTrack = week.players.filter((p) => p.days.length >= daysSoFar - (keptToday(p) ? 0 : 1));
  const shares = potShares({ potG: week.potG, players: onTrack }, 0);
  const me = wallet ? week.players.find((p) => p.wallet === wallet.toLowerCase()) ?? null : null;
  const meOnTrack = !!me && onTrack.some((p) => p.wallet === me.wallet);
  return {
    start,
    end,
    potG: week.potG,
    splitsAt: lagosMidnightIso(addDays(end, 1)),
    playersOnTrack: onTrack.length,
    /** G$ one ticket is worth if the week ended now — for "stake 1,000 = 5×" hints. */
    perTicket: (() => {
      const t = onTrack.reduce((n, p) => n + ticketsFor(p.stake, p.newcomer), 0);
      return t > 0 ? Math.floor(week.potG / t) : week.potG;
    })(),
    me: wallet
      ? {
          days: me?.days ?? [],
          onTrack: meOnTrack || (!me && daysSoFar === 1),
          keptToday: !!me && keptToday(me),
          newcomer: me?.newcomer ?? null,
          estimate: meOnTrack ? shares.get(me!.wallet) ?? 0 : 0,
          tickets: me ? ticketsFor(me.stake, me.newcomer) : 0,
          stake: me?.stake ?? 0,
        }
      : null,
  };
}

/**
 * Pays a finished week (idempotent: one reward row per wallet per week, and the
 * vault's rewardId blocks a second credit). Paid as weekly_consistency rewards
 * with their own keys, so they never collide with the 5-day weekly bonus.
 */
export async function payPotWeek(admin: Admin, start: string, opts: { deadlineMs?: number } = {}) {
  const deadline = Date.now() + (opts.deadlineMs ?? 50_000);
  const week = await loadPotWeek(admin, start);
  if (Date.now() < Date.parse(lagosMidnightIso(addDays(week.end, 1)))) return { start, skipped: "week not over" as const };
  const shares = potShares(week, 7);
  let reserved = 0;
  let sent = 0;
  for (const [wallet, amount] of shares) {
    if (amount <= 0) continue;
    const dedupeKey = `active-pot:${start}:${wallet}`;
    const row = await reserveReward(admin, {
      wallet,
      category: "weekly_consistency",
      amount,
      dedupeKey,
      rewardId: engineRewardId(dedupeKey),
      periodKey: `pot:${start}`,
      rewardDay: week.end,
      metadata: { kind: "active_pot", week: start, newcomer: week.players.find((p) => p.wallet === wallet)?.newcomer ?? false },
    });
    reserved++;
    if (Date.now() < deadline && (row.status === "pending" || row.status === "failed")) {
      const st = await processPayout(admin, row.id, { waitMs: 8_000 }).catch(() => null);
      if (st === "confirmed" || st === "submitted") sent++;
    }
  }
  return { start, qualifiers: shares.size, reserved, sent };
}
