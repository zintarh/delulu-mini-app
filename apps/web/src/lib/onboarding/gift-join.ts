import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { buildBingoView } from "@/lib/bingo/read";
import type { BingoCampaignRow } from "@/lib/bingo/types";
import { isValidOnChainChallengeId } from "@/lib/community/campaign-milestone-counts";
import { isCampaignExpired } from "@/lib/community/campaign-types";
import { ONBOARDING_GIFT_GDOLLARS } from "@/lib/onboarding/gift";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * The welcome gift is money to play with, not money to walk away with: it's
 * only deposited while there's something to join with it, and once claimed
 * the app stays blocked until they've joined. Gifts claimed before this went
 * live are left alone.
 */
export const GIFT_JOIN_REQUIRED_FROM_ISO = "2026-11-17T00:00:00+01:00";

export type GiftJoinTarget =
  | { kind: "bingo"; slug: string; title: string; tierKey: string; stake: number }
  | { kind: "campaign"; campaignId: string; title: string; stake: number };

/**
 * What to put the gift into right now: the live one-time starter Bingo
 * (Your First Week since 18 Nov; Delulu Debut before, now paused) if this
 * wallet can still play it; else a weekly Bingo on the biggest
 * tier the gift covers; else any live campaign priced at the gift. Null when
 * nothing is joinable.
 */
export async function findGiftJoinTarget(admin: Admin, wallet: string): Promise<GiftJoinTarget | null> {
  // First choice: the live one-time starter Bingo (Your First Week) — one per wallet, starts right away,
  // and its stake is the gift itself, so the 1,000 G$ goes straight into play.
  const { data: starters } = await admin
    .from("bingo_campaigns")
    .select("*")
    .eq("status", "live")
    .eq("enrollment", "rolling")
    .eq("recurrence", "one_time")
    .order("sort_order", { ascending: true });
  for (const row of (starters ?? []) as BingoCampaignRow[]) {
    const view = await buildBingoView(admin, row, wallet.toLowerCase()).catch(() => null);
    if (!view?.joinable || view.me) continue;
    const tier = view.tiers.filter((t) => t.ready && t.stake > 0 && t.stake <= ONBOARDING_GIFT_GDOLLARS).sort((a, b) => b.stake - a.stake)[0];
    if (tier) return { kind: "bingo", slug: view.slug, title: view.title, tierKey: tier.key, stake: tier.stake };
  }

  const { data: bingos } = await admin
    .from("bingo_campaigns")
    .select("*")
    .eq("status", "live")
    .eq("enrollment", "fixed")
    .order("sort_order", { ascending: true });
  for (const row of (bingos ?? []) as BingoCampaignRow[]) {
    const view = await buildBingoView(admin, row, wallet.toLowerCase()).catch(() => null);
    if (!view?.joinable || view.me) continue;
    const tier = view.tiers
      .filter((t) => t.ready && t.campaignId && t.stake > 0 && t.stake <= ONBOARDING_GIFT_GDOLLARS)
      .sort((a, b) => b.stake - a.stake)[0];
    if (tier) return { kind: "bingo", slug: view.slug, title: view.title, tierKey: tier.key, stake: tier.stake };
  }

  const { data: campaigns } = await admin
    .from("community_campaigns")
    .select("id, title, on_chain_challenge_id, is_hidden, status, display_ends_at, created_at, duration_days, join_amount, is_free_to_join")
    .eq("join_amount", ONBOARDING_GIFT_GDOLLARS)
    .is("bingo_cycle_id", null)
    .eq("is_free_to_join", false)
    .in("status", ["approved", "active"])
    .order("created_at", { ascending: false });
  const match = (campaigns ?? []).find((c) => !c.is_hidden && isValidOnChainChallengeId(c.on_chain_challenge_id) && !isCampaignExpired(c));
  if (!match) return null;
  const { data: joined } = await admin
    .from("campaign_participants")
    .select("id")
    .eq("campaign_id", match.id)
    .eq("wallet_address", wallet.toLowerCase())
    .maybeSingle();
  if (joined) return null;
  return { kind: "campaign", campaignId: match.id as string, title: (match.title as string) ?? "a campaign", stake: ONBOARDING_GIFT_GDOLLARS };
}

/**
 * Whether they've put real money in since claiming: a Bingo card or a paid
 * campaign joined after the claim, staking at least half the gift (so a
 * 100 G$ starter card from before Delulu Debut doesn't count as using it).
 */
export async function joinedSinceGift(admin: Admin, wallet: string, claimedAtIso: string): Promise<boolean> {
  const w = wallet.toLowerCase();
  const minStake = ONBOARDING_GIFT_GDOLLARS / 2;
  // Small slack: the join can be indexed a moment before mark-claimed lands.
  const since = new Date(Date.parse(claimedAtIso) - 10 * 60_000).toISOString();

  const { data: attempt } = await admin
    .from("bingo_attempts")
    .select("id")
    .eq("wallet", w)
    .gte("stake_amount", minStake)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  if (attempt) return true;

  const { data: joins } = await admin
    .from("campaign_participants")
    .select("campaign_id")
    .eq("wallet_address", w)
    .gte("joined_at", since);
  const ids = (joins ?? []).map((j) => j.campaign_id as string);
  if (ids.length === 0) return false;
  const { data: paid } = await admin
    .from("community_campaigns")
    .select("id")
    .in("id", ids)
    .eq("is_free_to_join", false)
    .gte("join_amount", minStake)
    .limit(1);
  return (paid ?? []).length > 0;
}

/** Claimed under the new rule and not yet put to work. */
export async function giftNeedsJoin(admin: Admin, wallet: string, claimedAtIso: string | null): Promise<boolean> {
  if (!claimedAtIso || claimedAtIso < GIFT_JOIN_REQUIRED_FROM_ISO) return false;
  return !(await joinedSinceGift(admin, wallet, claimedAtIso));
}

export type GiftModalState = { mustClaim: boolean; mustJoin: boolean; target: GiftJoinTarget | null };

/** What the gift modal should block on for this wallet right now. */
export async function giftModalState(admin: Admin, wallet: string, status: string | null, claimedAt: string | null): Promise<GiftModalState> {
  if (status !== "sent") return { mustClaim: false, mustJoin: false, target: null };
  const mustClaim = !claimedAt;
  const needsJoin = !mustClaim && (await giftNeedsJoin(admin, wallet, claimedAt));
  const target = mustClaim || needsJoin ? await findGiftJoinTarget(admin, wallet) : null;
  // Nothing open to join right now: don't block; the join step returns when one opens.
  return { mustClaim, mustJoin: needsJoin && target != null, target };
}
