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
import { everVerifiedWallets } from "@/lib/referral/verify-identity";
import { proofActivityForWallets } from "@/lib/community/campaign-subgraph";

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

export type PartnerListFilter = "all" | "claim" | "stake" | "join";

export type PartnerReport = {
  partner: Omit<Partner, "ownerWallet"> & { link: string };
  totals: {
    brought: number;
    claimed: number;
    staked: number;
    joined: number;
    profileIncomplete: number;
    back3: number;
    back7: number;
  };
  /** How many people match the current search and filter, not just this page. */
  filterCounts: { all: number; claim: number; stake: number; join: number };
  friends: PartnerFriend[];
  page: number;
  pageSize: number;
  totalFriends: number;
  generatedAt: string;
};

export const PARTNER_PAGE_SIZE = 10;

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

type Person = {
  address: string;
  username: string | null;
  created_at: string;
  onboarded_at: string | null;
  last_seen_at: string | null;
  claim_count: number | null;
  onboarding_gift_claimed_at: string | null;
};

type Snapshot = {
  at: number;
  people: Person[];
  joined: Set<string>;
  staked: Set<string>;
  days: Map<string, Set<string>>;
};

const cache = new Map<string, Snapshot>();

const claimed = (p: Person) => Number(p.claim_count ?? 0) >= 1 || !!p.onboarding_gift_claimed_at;

function matchesQuery(p: Person, q: string) {
  if (!q) return true;
  const s = q.toLowerCase().replace(/^@/, "");
  return p.address.includes(s) || (p.username ?? "").toLowerCase().includes(s);
}

function matchesFilter(p: Person, filter: PartnerListFilter, staked: Set<string>, joined: Set<string>) {
  if (filter === "claim") return !claimed(p);
  if (filter === "stake") return !staked.has(p.address);
  if (filter === "join") return !joined.has(p.address);
  return true;
}

async function rowsIn<T>(
  load: (slice: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  wallets: string[],
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < wallets.length; i += 100) {
    const { data, error } = await load(wallets.slice(i, i + 100));
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
  }
  return out;
}

async function loadSnapshot(admin: Admin, partner: Partner): Promise<Snapshot> {
  const hit = cache.get(partner.code);
  if (hit && Date.now() - hit.at < 120_000) return hit;
  if (!partner.ownerWallet) {
    const empty = { at: Date.now(), people: [], joined: new Set<string>(), staked: new Set<string>(), days: new Map<string, Set<string>>() };
    cache.set(partner.code, empty);
    return empty;
  }

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("address, username, created_at, onboarded_at, last_seen_at, claim_count, onboarding_gift_claimed_at")
    .eq("referred_by", partner.ownerWallet.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(5_000);
  if (profileError) throw new Error(profileError.message);
  const people: Person[] = (profiles ?? []).map((p) => ({
    address: String(p.address).toLowerCase(),
    username: p.username ?? null,
    created_at: String(p.created_at),
    onboarded_at: p.onboarded_at ?? null,
    last_seen_at: p.last_seen_at ?? null,
    claim_count: p.claim_count ?? null,
    onboarding_gift_claimed_at: p.onboarding_gift_claimed_at ?? null,
  }));
  const wallets = people.map((p) => p.address);
  const [joins, bingos, goals, presence] = await Promise.all([
    rowsIn(
      (slice) => admin.from("campaign_participants").select("wallet_address").in("wallet_address", slice).limit(20_000),
      wallets,
    ),
    rowsIn(
      (slice) => admin.from("bingo_attempts").select("wallet, stake_amount").in("wallet", slice).limit(20_000),
      wallets,
    ),
    rowsIn(
      (slice) => admin.from("forfeit_commitments").select("creator_wallet, stake_amount_wei").in("creator_wallet", slice).limit(20_000),
      wallets,
    ),
    rowsIn(
      (slice) => admin.from("presence_days").select("wallet, day").in("wallet", slice).limit(20_000),
      wallets,
    ),
  ]);
  const joined = new Set<string>([
    ...joins.map((r) => String(r.wallet_address).toLowerCase()),
    ...bingos.map((r) => String(r.wallet).toLowerCase()),
  ]);
  const staked = new Set<string>();
  for (const r of bingos) {
    if (Number(r.stake_amount ?? 0) > 0) staked.add(String(r.wallet).toLowerCase());
  }
  for (const g of goals) {
    try {
      if (BigInt(String(g.stake_amount_wei ?? "0")) > 0n) staked.add(String(g.creator_wallet).toLowerCase());
    } catch {
      /* a bad wei value is not a stake */
    }
  }
  const days = new Map<string, Set<string>>();
  const addDay = (w: string, d: string) => (days.get(w) ?? days.set(w, new Set()).get(w)!).add(d);
  for (const r of presence) addDay(String(r.wallet).toLowerCase(), String(r.day));

  const snapshot = { at: Date.now(), people, joined, staked, days };
  cache.set(partner.code, snapshot);
  return snapshot;
}

function daysBackFor(p: Person, days: Map<string, Set<string>>, proofTimes: number[]) {
  const signupDay = lagosDay(Date.parse(p.created_at));
  const seen = new Set<string>();
  for (const d of days.get(p.address) ?? []) if (d > signupDay) seen.add(d);
  for (const t of proofTimes) {
    const d = lagosDay(t);
    if (d > signupDay) seen.add(d);
  }
  return seen.size;
}

export async function buildPartnerReport(
  admin: Admin,
  partner: Partner,
  appUrl: string,
  opts?: { page?: number; q?: string; filter?: PartnerListFilter },
): Promise<PartnerReport> {
  const link = `${appUrl.replace(/\/$/, "")}/join/${partner.code}`;
  const snapshot = await loadSnapshot(admin, partner);
  const q = opts?.q?.trim().slice(0, 80) ?? "";
  const filter = opts?.filter ?? "all";
  const searched = snapshot.people.filter((p) => matchesQuery(p, q));
  const filterCounts = {
    all: searched.length,
    claim: searched.filter((p) => matchesFilter(p, "claim", snapshot.staked, snapshot.joined)).length,
    stake: searched.filter((p) => matchesFilter(p, "stake", snapshot.staked, snapshot.joined)).length,
    join: searched.filter((p) => matchesFilter(p, "join", snapshot.staked, snapshot.joined)).length,
  };
  const matched = searched.filter((p) => matchesFilter(p, filter, snapshot.staked, snapshot.joined));
  const totalFriends = matched.length;
  const totalPages = Math.max(1, Math.ceil(totalFriends / PARTNER_PAGE_SIZE));
  const page = Math.min(Math.max(1, opts?.page ?? 1), totalPages);
  const slice = matched.slice((page - 1) * PARTNER_PAGE_SIZE, page * PARTNER_PAGE_SIZE);
  const wallets = slice.map((p) => p.address);
  const [verified, activity] = wallets.length
    ? await Promise.all([everVerifiedWallets(wallets), proofActivityForWallets(wallets)])
    : [new Set<string>(), new Map<string, { points: number; times: number[] }>()];

  const friends: PartnerFriend[] = slice.map((p) => {
    const stat = activity.get(p.address);
    const row = {
      verified: verified.has(p.address),
      claimed: claimed(p),
      staked: snapshot.staked.has(p.address),
      joined: snapshot.joined.has(p.address),
      points: stat?.points ?? 0,
    };
    const missing = partnerMissing(row, partner.minPoints);
    return {
      wallet: p.address,
      username: p.username,
      signedUpAt: p.created_at,
      profileComplete: !!p.onboarded_at && !!p.username,
      ...row,
      completed: missing == null,
      missing,
      daysBack: daysBackFor(p, snapshot.days, stat?.times ?? []),
      lastSeenAt: p.last_seen_at,
    };
  });

  const back = (n: number) => snapshot.people.filter((p) => daysBackFor(p, snapshot.days, []) >= n).length;
  return {
    partner: { code: partner.code, name: partner.name, minPoints: partner.minPoints, active: partner.active, link },
    totals: {
      brought: snapshot.people.length,
      claimed: snapshot.people.filter((p) => claimed(p)).length,
      staked: snapshot.people.filter((p) => snapshot.staked.has(p.address)).length,
      joined: snapshot.people.filter((p) => snapshot.joined.has(p.address)).length,
      profileIncomplete: snapshot.people.filter((p) => !p.onboarded_at || !p.username).length,
      back3: back(3),
      back7: back(7),
    },
    filterCounts,
    friends,
    page,
    pageSize: PARTNER_PAGE_SIZE,
    totalFriends,
    generatedAt: new Date().toISOString(),
  };
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
