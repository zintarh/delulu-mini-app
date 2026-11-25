import type { getSupabaseAdmin } from "@/lib/push/supabase";
import type { BingoTier } from "@/lib/bingo/types";
import { loadRewardsConfig } from "@/lib/rewards/config";
import { isLeaderboardBlacklisted } from "@/lib/constant";
import { toMoney, type EarnFacts } from "@/lib/earn/format";
import { FIRST_WEEK_SLUG } from "@/lib/bingo/first-week";

export * from "@/lib/earn/format";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * "What's at stake" numbers for nudges and the Home card: what the 7-day Bingo
 * really pays (from its live tier config — we never promise more than it pays),
 * and what top players have actually earned, in $ and ₦ at live rates.
 */

/** Used when the price feeds are down — conservative (today: $0.000101, ₦1,353). */
const FALLBACK_GD_USD = 0.0001;
const FALLBACK_NGN_PER_USD = 1350;
const SEVEN_DAY_SLUG = "outside-your-bubble";
const CACHE_MS = 30 * 60_000;
let cached: { facts: EarnFacts; at: number } | null = null;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: 1800 } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}


/**
 * What a 7-day tier's card pays: 7 photos + the finishing reward. The weekly
 * streak bonus is a separate reward (not the card's), so it isn't counted —
 * the card must never promise more than finishing it pays (25 Nov 2026).
 */
export function sevenDayTierTotal(tier: Pick<BingoTier, "rewardPerSquare" | "completionReward" | "potShare" | "stake">, dailyAmount: number): number {
  const perPhoto = typeof tier.rewardPerSquare === "number" ? tier.rewardPerSquare : dailyAmount;
  // Pot-share tiers: at most their own stake from the pot (see lib/bingo/reward.ts).
  return perPhoto * 7 + (tier.potShare ? tier.stake : (tier.completionReward ?? 0));
}

export async function getEarnFacts(admin: Admin): Promise<EarnFacts> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.facts;

  const [price, fx, config, bingo, credits, earners] = await Promise.all([
    fetchJson<{ gooddollar?: { usd?: number } }>("https://api.coingecko.com/api/v3/simple/price?ids=gooddollar&vs_currencies=usd"),
    fetchJson<{ rates?: { NGN?: number } }>("https://open.er-api.com/v6/latest/USD"),
    loadRewardsConfig(admin),
    admin.from("bingo_campaigns").select("slug, title, status, current_version_id").in("slug", [SEVEN_DAY_SLUG, FIRST_WEEK_SLUG]),
    admin.from("referral_credits").select("referrer_wallet, gdollars_amount").eq("payout_status", "sent").limit(10_000),
    admin.from("profiles").select("address, username, total_earned_usdt").gt("total_earned_usdt", 0).order("total_earned_usdt", { ascending: false }).limit(10),
  ]);
  const gdUsd = price?.gooddollar?.usd && price.gooddollar.usd > 0 ? price.gooddollar.usd : FALLBACK_GD_USD;
  const ngnPerUsd = fx?.rates?.NGN && fx.rates.NGN > 0 ? fx.rates.NGN : FALLBACK_NGN_PER_USD;
  const money = (g: number) => toMoney(g, gdUsd, ngnPerUsd);

  // What a live 7-day Bingo really pays, from its tier config.
  const daily = config.dailyProof.enabled ? config.dailyProof.amount : 0;
  const sevenDayOf = async (row: { slug: string; title: string; status: string; current_version_id: string | null } | null) => {
    if (row?.status !== "live" || !row.current_version_id) return null;
    const { data: v } = await admin.from("bingo_versions").select("tiers").eq("id", row.current_version_id).maybeSingle();
    const tiers = (v?.tiers ?? []) as BingoTier[];
    const totals = tiers.map((t) => sevenDayTierTotal(t, daily));
    if (!totals.length) return null;
    const entryTier = tiers[totals.indexOf(Math.min(...totals))];
    return {
      slug: row.slug,
      title: row.title,
      entry: money(Math.min(...totals)),
      top: money(Math.max(...totals)),
      perPhoto: typeof entryTier.rewardPerSquare === "number" ? entryTier.rewardPerSquare : daily,
      stake: entryTier.stake,
      potShare: !!entryTier.potShare,
    };
  };
  const rows = (bingo.data ?? []) as { slug: string; title: string; status: string; current_version_id: string | null }[];
  const [sevenDay, firstWeek] = await Promise.all([
    sevenDayOf(rows.find((r) => r.slug === SEVEN_DAY_SLUG) ?? null),
    sevenDayOf(rows.find((r) => r.slug === FIRST_WEEK_SLUG) ?? null),
  ]);

  // Top referrers by G$ actually paid out.
  const byRef = new Map<string, number>();
  for (const c of credits.data ?? []) {
    const w = String(c.referrer_wallet).toLowerCase();
    if (isLeaderboardBlacklisted(w)) continue;
    byRef.set(w, (byRef.get(w) ?? 0) + Number(c.gdollars_amount ?? 0));
  }
  const topRef = [...byRef].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const { data: refNames } = topRef.length
    ? await admin.from("profiles").select("address, username").in("address", topRef.map(([w]) => w))
    : { data: [] as { address: string; username: string | null }[] };
  const nameOf = new Map((refNames ?? []).map((r) => [String(r.address).toLowerCase(), r.username as string | null]));
  const topReferrers = topRef
    .map(([w, g]) => ({ name: nameOf.get(w) ?? `${w.slice(0, 6)}…`, ...money(g) }))
    .map(({ name, usd, ngn }) => ({ name, usd, ngn }));

  // Top campaign earners (prizes, tracked in USD).
  const topCampaign = (earners.data ?? [])
    .filter((e) => !isLeaderboardBlacklisted(String(e.address)) && e.username)
    .slice(0, 3)
    .map((e) => ({ name: String(e.username), usd: Number(e.total_earned_usdt), ngn: Number(e.total_earned_usdt) * ngnPerUsd }));

  const facts: EarnFacts = { gdUsd, ngnPerUsd, sevenDay, firstWeek, topReferrers, topCampaign };
  cached = { facts, at: Date.now() };
  return facts;
}
