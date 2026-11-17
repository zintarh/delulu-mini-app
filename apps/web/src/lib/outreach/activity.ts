import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { CELO_MAINNET_ID, getSubgraphUrlForChain, isLeaderboardBlacklisted } from "@/lib/constant";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * Everyone who has ever proved anything, with how consistently and what the
 * app has paid them — the data behind admin → Outreach → Win back.
 *
 * An "active day" is a calendar day (Africa/Lagos) with at least one proof:
 * a campaign milestone completion, a verified Delulu milestone, or a Forfeit
 * goal day with an on-chain proof that wasn't rejected. Many proofs on one
 * day count once.
 */
export type OutreachPerson = {
  wallet: string;
  username: string | null;
  email: string | null;
  activeDays: number;
  firstActive: string;
  lastActive: string;
  joined: string | null;
  /** G$ the app has paid them, all sources. */
  earnedGd: number;
  earnedUsdt: number;
  rewardSources: string[];
  /** Last outreach email, if any. */
  lastEmailedAt: string | null;
  lastEmailTemplate: string | null;
};

const TZ = "Africa/Lagos";
const dayOf = (sec: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(sec * 1000));

async function gql(url: string, query: string, variables: Record<string, unknown>) {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && !json.errors) return json.data;
      last = json.errors?.[0]?.message ?? res.status;
    } catch (err) {
      last = err;
    }
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }
  throw new Error(`[outreach] subgraph query failed: ${String(last)}`);
}

/** Pages by timestamp (The Graph caps `skip`), deduping rows that share the cursor second. */
async function pageAll(url: string, entity: string, tsField: string, where: string, fields: string) {
  const out = new Map<string, Record<string, any>>();
  let cursor = "0";
  for (let guard = 0; guard < 500; guard++) {
    const q = `query($c: BigInt!) { ${entity}(first: 1000, orderBy: ${tsField}, orderDirection: asc, where: { ${tsField}_gt: $c ${where} }) { id ${fields} } }`;
    const rows = ((await gql(url, q, { c: cursor }))?.[entity] ?? []) as Record<string, any>[];
    for (const r of rows) out.set(r.id, r);
    if (rows.length < 1000) break;
    cursor = String(Number(rows[rows.length - 1][tsField]) - 1);
  }
  return [...out.values()];
}

async function selectAll<T>(fetchPage: (_from: number, _to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const CACHE_MS = 10 * 60_000;
let cached: { at: number; people: OutreachPerson[] } | null = null;

/** Drops the cached list (after sending, so "last emailed" updates). */
export function invalidateOutreachCache() {
  cached = null;
}

export async function loadOutreachPeople(admin: SupabaseAdmin, { fresh = false } = {}): Promise<OutreachPerson[]> {
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.people;

  const url = getSubgraphUrlForChain(CELO_MAINNET_ID) || process.env.NEXT_PUBLIC_SUBGRAPH_URL;
  if (!url) throw new Error("Subgraph URL not configured");

  const days = new Map<string, Set<string>>();
  const add = (wallet: string | null | undefined, sec: number) => {
    if (!wallet || !(sec > 0)) return;
    const w = wallet.toLowerCase();
    let set = days.get(w);
    if (!set) days.set(w, (set = new Set()));
    set.add(dayOf(sec));
  };

  const [completions, milestones, commitments, periods] = await Promise.all([
    pageAll(url, "communityCampaignMilestoneCompletions", "createdAt", "", "participantAddress createdAt"),
    pageAll(url, "milestones", "verifiedAt", ", isVerified: true", "verifiedAt delulu { creatorAddress }").catch(() => []),
    selectAll<{ id: string; creator_wallet: string }>((a, b) => admin.from("forfeit_commitments").select("id, creator_wallet").range(a, b)),
    selectAll<{ commitment_id: string; tx_hash: string | null; verifier_action: string | null; created_at: string }>((a, b) =>
      admin
        .from("forfeit_periods")
        .select("commitment_id, tx_hash, verifier_action, created_at")
        .not("proof_url", "is", null)
        .range(a, b),
    ),
  ]);
  for (const r of completions) add(r.participantAddress, Number(r.createdAt));
  for (const r of milestones) add(r.delulu?.creatorAddress, Number(r.verifiedAt));
  const creator = new Map(commitments.map((c) => [c.id, c.creator_wallet]));
  for (const p of periods) {
    if (!p.tx_hash || p.verifier_action === "rejected" || p.verifier_action === "timed_out") continue;
    add(creator.get(p.commitment_id), Math.floor(new Date(p.created_at).getTime() / 1000));
  }

  const wallets = [...days.keys()].filter((w) => !isLeaderboardBlacklisted(w));
  const chunks = <T,>(xs: T[], n = 300) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

  const profiles = new Map<string, { username: string | null; email: string | null; joined: string | null; gift: boolean }>();
  const earned = new Map<string, { gd: number; usdt: number; sources: Set<string> }>();
  const credit = (w: string, source: string, token: string, amount: number) => {
    if (!(amount > 0)) return;
    const key = w.toLowerCase();
    let e = earned.get(key);
    if (!e) earned.set(key, (e = { gd: 0, usdt: 0, sources: new Set() }));
    if (token === "USDT" || token === "USDC") e.usdt += amount;
    else e.gd += amount;
    e.sources.add(source);
  };
  const lastEmail = new Map<string, { at: string; template: string | null }>();

  for (const part of chunks(wallets)) {
    const [prof, grants, payouts, legacy, referrals, claims, emails] = await Promise.all([
      admin.from("profiles").select("address, username, email, created_at, onboarding_gift_paid_at").in("address", part),
      admin.from("admin_reward_grants").select("recipient_address, amount, token_symbol").in("recipient_address", part),
      admin.from("reward_payouts").select("wallet, amount").eq("status", "confirmed").in("wallet", part).limit(20_000),
      admin.from("proof_rewards").select("wallet, amount").eq("status", "sent").in("wallet", part).limit(20_000),
      admin.from("referral_credits").select("referrer_wallet, gdollars_amount").eq("payout_status", "sent").in("referrer_wallet", part),
      admin.from("campaign_payout_claims").select("wallet_address, amount_wei").in("wallet_address", part),
      admin
        .from("outreach_emails")
        .select("wallet, template_id, created_at")
        .eq("status", "sent")
        .in("wallet", part)
        .order("created_at", { ascending: false }),
    ]);
    for (const p of prof.data ?? []) {
      const email = typeof p.email === "string" && p.email.includes("@") && !p.email.endsWith("@wallet.local") ? p.email : null;
      profiles.set((p.address as string).toLowerCase(), {
        username: (p.username as string | null) ?? null,
        email,
        joined: (p.created_at as string | null)?.slice(0, 10) ?? null,
        gift: Boolean(p.onboarding_gift_paid_at),
      });
    }
    for (const r of grants.data ?? []) credit(r.recipient_address as string, "Leaderboard & admin", String(r.token_symbol), Number(r.amount));
    for (const r of payouts.data ?? []) credit(r.wallet as string, "Proof rewards", "G$", Number(r.amount));
    for (const r of legacy.data ?? []) credit(r.wallet as string, "Proof rewards", "G$", Number(r.amount));
    for (const r of referrals.data ?? []) credit(r.referrer_wallet as string, "Referrals", "G$", Number(r.gdollars_amount));
    for (const r of claims.data ?? []) {
      try {
        credit(r.wallet_address as string, "Mission wins", "G$", Number(BigInt(r.amount_wei as string) / 10n ** 15n) / 1000);
      } catch {}
    }
    // outreach_emails may not exist yet (migration not run): treat as never emailed.
    for (const r of emails.data ?? []) {
      const w = (r.wallet as string).toLowerCase();
      if (!lastEmail.has(w)) lastEmail.set(w, { at: r.created_at as string, template: (r.template_id as string | null) ?? null });
    }
  }

  const people: OutreachPerson[] = wallets
    .map((w) => {
      const d = [...days.get(w)!].sort();
      const p = profiles.get(w);
      const e = earned.get(w);
      const sources = e ? [...e.sources] : [];
      if (p?.gift) sources.push("Welcome gift");
      return {
        wallet: w,
        username: p?.username ?? null,
        email: p?.email ?? null,
        activeDays: d.length,
        firstActive: d[0],
        lastActive: d[d.length - 1],
        joined: p?.joined ?? null,
        earnedGd: Math.round(e?.gd ?? 0),
        earnedUsdt: Math.round((e?.usdt ?? 0) * 100) / 100,
        rewardSources: sources,
        lastEmailedAt: lastEmail.get(w)?.at ?? null,
        lastEmailTemplate: lastEmail.get(w)?.template ?? null,
      };
    })
    .sort((a, b) => b.activeDays - a.activeDays || b.earnedGd - a.earnedGd);

  cached = { at: Date.now(), people };
  return people;
}
