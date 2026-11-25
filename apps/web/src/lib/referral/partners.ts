// Partner referral links (staydelulu.xyz/join/BIGJAY) and the partner's own
// analytics page (/partner/BIGJAY). Server only.
//
// A friend counts as COMPLETED once they have: signed up through the link,
// passed the GoodDollar face check, claimed their free G$, staked that G$ on
// a Delulu card (Bingo or a money Forfeit — the contract interaction
// GoodDollar looks for), joined a mission or Bingo, and earned the partner's
// points target (100 by default: one kept photo on a 100 G$ card). "Came back" counts the distinct Lagos
// days after sign-up they were active (app opened — presence_days — or a
// proof kept), not counting sign-up day.

import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { isGoodDollarVerified } from "@/lib/referral/verify-identity";
import { totalProofPointsOnGraph } from "@/lib/community/campaign-subgraph";
import { loadActivity } from "@/lib/analytics/retention";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export type Partner = { code: string; ownerWallet: string | null; name: string; minPoints: number; active: boolean };

/** The next step a friend still needs, in the order a counted referral requires. */
export type PartnerMissing = "verify" | "claim" | "stake" | "join" | "points";

export type PartnerFriend = {
  wallet: string;
  username: string | null;
  signedUpAt: string;
  profileComplete: boolean;
  verified: boolean;
  /** Claimed free G$ at least once (GoodDollar daily claim). */
  claimed: boolean;
  /** Staked real G$ on a Bingo or a money Forfeit. */
  staked: boolean;
  joined: boolean;
  points: number;
  completed: boolean;
  /** Null once every step above is done. */
  missing: PartnerMissing | null;
  /** Distinct days active after the sign-up day. */
  daysBack: number;
  lastSeenAt: string | null;
};

export type PartnerReport = {
  partner: Omit<Partner, "ownerWallet"> & { link: string };
  totals: {
    brought: number;
    completed: number;
    verified: number;
    claimed: number;
    staked: number;
    joined: number;
    profileIncomplete: number;
    back3: number;
    back7: number;
  };
  friends: PartnerFriend[];
  generatedAt: string;
};

export const CODE_RE = /^[A-Z0-9]{3,20}$/;

/** First unfinished step. Null means the friend counts. */
export function partnerMissing(
  f: Pick<PartnerFriend, "verified" | "claimed" | "staked" | "joined" | "points">,
  minPoints: number,
): PartnerMissing | null {
  if (!f.verified) return "verify";
  if (!f.claimed) return "claim";
  if (!f.staked) return "stake";
  if (!f.joined) return "join";
  if (f.points < minPoints) return "points";
  return null;
}
const lagosDay = (ms: number) => new Date(ms + 3_600_000).toISOString().slice(0, 10);

export async function loadPartner(admin: Admin, codeRaw: string): Promise<Partner | null> {
  const code = codeRaw.trim().toUpperCase();
  if (!CODE_RE.test(code)) return null;
  const { data } = await admin.from("referral_partners").select("code, owner_wallet, name, min_points, active").eq("code", code).maybeSingle();
  if (!data) return null;
  return { code: data.code, ownerWallet: data.owner_wallet ?? null, name: data.name, minPoints: Number(data.min_points), active: !!data.active };
}

/** Run `fn` over `items`, `n` at a time (on-chain and subgraph reads per friend). */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}

const cache = new Map<string, { at: number; report: PartnerReport }>();

export async function buildPartnerReport(admin: Admin, partner: Partner, appUrl: string): Promise<PartnerReport> {
  const hit = cache.get(partner.code);
  if (hit && Date.now() - hit.at < 120_000) return hit.report;

  const link = `${appUrl.replace(/\/$/, "")}/join/${partner.code}`;
  const empty: PartnerReport = {
    partner: { code: partner.code, name: partner.name, minPoints: partner.minPoints, active: partner.active, link },
    totals: { brought: 0, completed: 0, verified: 0, claimed: 0, staked: 0, joined: 0, profileIncomplete: 0, back3: 0, back7: 0 },
    friends: [],
    generatedAt: new Date().toISOString(),
  };
  if (!partner.ownerWallet) return empty;

  const { data: profiles } = await admin
    .from("profiles")
    .select("address, username, created_at, onboarded_at, last_seen_at, claim_count, onboarding_gift_claimed_at")
    .eq("referred_by", partner.ownerWallet.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(5_000);
  const people = (profiles ?? []).map((p) => ({ ...p, address: String(p.address).toLowerCase() }));
  if (people.length === 0) return empty;
  const wallets = people.map((p) => p.address);
  const earliest = Math.min(...people.map((p) => Date.parse(String(p.created_at))));

  const [joins, bingos, goals, presence, activity] = await Promise.all([
    admin.from("campaign_participants").select("wallet_address").in("wallet_address", wallets).limit(20_000),
    admin.from("bingo_attempts").select("wallet, stake_amount").in("wallet", wallets).limit(20_000),
    admin.from("forfeit_commitments").select("creator_wallet, stake_amount_wei").in("creator_wallet", wallets).limit(20_000),
    admin.from("presence_days").select("wallet, day").in("wallet", wallets).limit(100_000),
    loadActivity(admin, earliest).catch(() => new Map<string, number[]>()),
  ]);
  const joined = new Set<string>([
    ...(joins.data ?? []).map((r) => String(r.wallet_address).toLowerCase()),
    ...(bingos.data ?? []).map((r) => String(r.wallet).toLowerCase()),
  ]);
  const staked = new Set<string>();
  for (const r of bingos.data ?? []) {
    if (Number(r.stake_amount ?? 0) > 0) staked.add(String(r.wallet).toLowerCase());
  }
  for (const g of goals.data ?? []) {
    try {
      if (BigInt(String(g.stake_amount_wei ?? "0")) > 0n) staked.add(String(g.creator_wallet).toLowerCase());
    } catch {
      /* a bad wei value is not a stake */
    }
  }
  const days = new Map<string, Set<string>>();
  const addDay = (w: string, d: string) => (days.get(w) ?? days.set(w, new Set()).get(w)!).add(d);
  for (const r of presence.data ?? []) addDay(String(r.wallet).toLowerCase(), String(r.day));
  for (const w of wallets) for (const t of activity.get(w) ?? []) addDay(w, lagosDay(t));

  const chain = await pool(people, 6, async (p) => {
    const [verified, points] = await Promise.all([
      isGoodDollarVerified(p.address).catch(() => false),
      totalProofPointsOnGraph(p.address).then((x) => x.total).catch(() => 0),
    ]);
    return { verified, points };
  });

  const friends: PartnerFriend[] = people.map((p, i) => {
    const signupDay = lagosDay(Date.parse(String(p.created_at)));
    const daysBack = [...(days.get(p.address) ?? [])].filter((d) => d > signupDay).length;
    const isJoined = joined.has(p.address);
    const { verified, points } = chain[i];
    const row = {
      verified,
      claimed: Number(p.claim_count ?? 0) >= 1 || !!p.onboarding_gift_claimed_at,
      staked: staked.has(p.address),
      joined: isJoined,
      points,
    };
    const missing = partnerMissing(row, partner.minPoints);
    return {
      wallet: p.address,
      username: p.username ?? null,
      signedUpAt: String(p.created_at),
      profileComplete: !!p.onboarded_at && !!p.username,
      ...row,
      completed: missing == null,
      missing,
      daysBack,
      lastSeenAt: p.last_seen_at ?? null,
    };
  });

  const report: PartnerReport = {
    ...empty,
    totals: {
      brought: friends.length,
      completed: friends.filter((f) => f.completed).length,
      verified: friends.filter((f) => f.verified).length,
      claimed: friends.filter((f) => f.claimed).length,
      staked: friends.filter((f) => f.staked).length,
      joined: friends.filter((f) => f.joined).length,
      profileIncomplete: friends.filter((f) => !f.profileComplete).length,
      back3: friends.filter((f) => f.daysBack >= 3).length,
      back7: friends.filter((f) => f.daysBack >= 7).length,
    },
    friends,
  };
  cache.set(partner.code, { at: Date.now(), report });
  return report;
}

/**
 * Point a partner code at a wallet: the code becomes that profile's own
 * referral code (so /join/CODE attributes to them) and the partner row
 * records the owner. Fails if another profile already uses the code.
 */
export async function assignPartner(admin: Admin, code: string, wallet: string) {
  const w = wallet.toLowerCase();
  const { data: profile } = await admin.from("profiles").select("address, referral_code").eq("address", w).maybeSingle();
  if (!profile) throw new Error("No Delulu account with that wallet. They need to sign up first.");
  const { data: taken } = await admin.from("profiles").select("address").eq("referral_code", code).maybeSingle();
  if (taken && String(taken.address).toLowerCase() !== w) throw new Error(`Code ${code} is already used by another account.`);
  const { error: e1 } = await admin.from("profiles").update({ referral_code: code }).eq("address", w);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await admin.from("referral_partners").update({ owner_wallet: w, updated_at: new Date().toISOString() }).eq("code", code);
  if (e2) throw new Error(e2.message);
  cache.delete(code);
}
