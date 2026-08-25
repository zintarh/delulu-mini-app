export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getSubgraphUrlForChain, CELO_MAINNET_ID } from "@/lib/constant";
import { getKeeperStatus, resolveCommitmentForfeitedAsKeeper } from "@/lib/celo/forfeit-keeper";
import { notifyManyRecipients } from "@/lib/push/notify-recipients";
import { getTokenSymbol, weiToTokenAmount } from "@/lib/token-amounts";
import { creditProfileEarnedFromToken } from "@/lib/profile-earned";
import { normalizeMarketingAppUrl } from "@/lib/marketing-email-template";
import { sendRewardNotificationEmail } from "@/lib/email/send-reward-notification";

async function fetchGraph(url: string, query: string, variables: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Subgraph request failed: ${res.status}`);
  return res.json();
}

const OVERDUE_QUERY = `
  query OverdueForfeitCommitments($now: BigInt!) {
    forfeitCommitments(
      first: 200
      where: { active: true, cancelled: false, currentPeriodDeadline_lt: $now }
      orderBy: currentPeriodDeadline
      orderDirection: asc
    ) {
      commitmentId
    }
  }
`;

const RECENT_FORFEITED_QUERY = `
  query RecentForfeitedResolutions {
    forfeitPeriodResolutions(
      first: 100
      where: { outcome: "forfeited" }
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      commitmentId
      periodIndex
      resolver
      bountyPaid
      platformFee
      destinationType
      destinationAddr
      amountToDestination
      txHash
      createdAt
    }
  }
`;

// Separate from RECENT_FORFEITED_QUERY: FriendRewardCredited fires from both
// resolveCommitmentForfeited (deadline miss) and cancelCommitment (voluntary),
// but cancelCommitment never creates a ForfeitPeriodResolution row — so relying
// on that entity alone would miss friend rewards from cancellations.
const RECENT_FRIEND_REWARDS_QUERY = `
  query RecentFriendRewards {
    forfeitFriendRewards(
      first: 100
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      commitmentId
      recipientAddress
      token
      amount
      txHash
      createdAt
    }
  }
`;

/**
 * Backstop keeper + resolution sync, run on a schedule (see vercel.json).
 *
 * 1) Resolves any commitment whose current period deadline has passed with no
 *    success recorded — the permissionless `resolveCommitmentForfeited` keeper
 *    bounty is a decentralization backstop, not the primary guarantee (small
 *    stakes don't reliably attract third-party keepers), so this cron is the
 *    keeper of last resort.
 * 2) Syncs any recently-forfeited period (whether resolved by this cron, a
 *    third-party keeper, or a public caller) from the subgraph into Supabase
 *    and notifies the creator — covers all three triggers uniformly instead
 *    of only reacting to this cron's own transactions.
 * 3) Syncs any new Friend-destination reward credits into Supabase (idempotent
 *    by subgraph event id) and emails/push-notifies the recipient — the stake
 *    itself was already credited on-chain the instant the forfeiture resolved
 *    (see ForfeitMarket.claimFriendReward); this step is purely notification +
 *    the leaderboard "earned" credit, not a money movement.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isCronAuthorized(req)) {
      return errorResponse("Unauthorized", 401);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return errorResponse("Missing Supabase credentials.", 500);

    const subgraphUrl = getSubgraphUrlForChain(CELO_MAINNET_ID) || process.env.NEXT_PUBLIC_SUBGRAPH_URL;
    if (!subgraphUrl) return errorResponse("Missing subgraph URL.", 500);

    const nowSec = Math.floor(Date.now() / 1000);

    // ── 1) Backstop-resolve overdue commitments ──
    const overdueResp = await fetchGraph(subgraphUrl, OVERDUE_QUERY, { now: String(nowSec) });
    const overdue: Array<{ commitmentId: string }> = overdueResp?.data?.forfeitCommitments ?? [];

    let resolved = 0;
    let resolveFailed = 0;
    const resolveErrors: Array<{ commitmentId: string; error: string }> = [];
    for (const c of overdue) {
      try {
        await resolveCommitmentForfeitedAsKeeper(BigInt(c.commitmentId));
        resolved++;
      } catch (err) {
        resolveFailed++;
        const message = err instanceof Error ? err.message : String(err);
        resolveErrors.push({ commitmentId: c.commitmentId, error: message });
        console.error(`[forfeit-deadline-check] resolve failed for ${c.commitmentId}:`, err);
      }
    }

    // Surfaced whenever anything failed to resolve, so the wallet's funding
    // state is visible in the response itself — no Vercel log access needed
    // to tell "unfunded keeper" apart from "something else reverted".
    let keeper: { address: string; celoBalance: string } | { error: string } | null = null;
    if (resolveFailed > 0) {
      try {
        keeper = await getKeeperStatus();
      } catch (err) {
        keeper = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    // ── 2) Sync recent forfeitures into Supabase + notify creators ──
    const recentResp = await fetchGraph(subgraphUrl, RECENT_FORFEITED_QUERY, {});
    const recent: Array<{
      commitmentId: string;
      periodIndex: number;
      txHash: string;
      createdAt: string;
    }> = recentResp?.data?.forfeitPeriodResolutions ?? [];

    let synced = 0;
    let notified = 0;
    for (const r of recent) {
      const { data: commitment } = await supabase
        .from("forfeit_commitments")
        .select("id, creator_wallet, title, status")
        .eq("on_chain_commitment_id", Number(r.commitmentId))
        .maybeSingle();

      if (!commitment || commitment.status === "forfeited") continue;

      await supabase.from("forfeit_periods").upsert(
        {
          commitment_id: commitment.id,
          period_index: r.periodIndex,
          resolved_at: new Date(Number(r.createdAt) * 1000).toISOString(),
          tx_hash: r.txHash,
          verifier_action: "timed_out",
        },
        { onConflict: "commitment_id,period_index" },
      );

      await supabase
        .from("forfeit_commitments")
        .update({ status: "forfeited" })
        .eq("id", commitment.id);
      synced++;

      const result = await notifyManyRecipients(supabase, [commitment.creator_wallet], {
        title: "Forfeit missed",
        body: `"${commitment.title}" wasn't completed in time — your stake has been forfeited.`,
        url: "/profile",
        type: "forfeit_resolved",
        message: `You missed **${commitment.title}** — your stake has been forfeited.`,
        eventKeyFor: (addr) => `forfeit_resolved:${commitment.id}:${r.periodIndex}:${addr}`,
      });
      notified += result.sent;
    }

    // ── 3) Sync new Friend-destination reward credits + notify recipients ──
    const friendResp = await fetchGraph(subgraphUrl, RECENT_FRIEND_REWARDS_QUERY, {});
    const friendRewards: Array<{
      id: string;
      commitmentId: string;
      recipientAddress: string;
      token: string;
      amount: string;
      txHash: string;
      createdAt: string;
    }> = friendResp?.data?.forfeitFriendRewards ?? [];

    const appUrl = normalizeMarketingAppUrl(
      process.env.NEXT_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://www.staydelulu.xyz",
    );

    let friendRewardsSynced = 0;
    let friendRewardsNotified = 0;
    let friendRewardsEmailed = 0;
    for (const r of friendRewards) {
      const recipientAddress = r.recipientAddress.toLowerCase();
      const tokenAddress = r.token.toLowerCase();
      const amountNum = weiToTokenAmount(r.amount, tokenAddress);
      const tokenSymbol = getTokenSymbol(tokenAddress);

      const { data: profile } = await supabase
        .from("profiles")
        .select("email, username")
        .ilike("address", recipientAddress)
        .maybeSingle();
      const profileEmail = profile?.email?.trim().toLowerCase() ?? "";
      const hasRealEmail =
        !!profileEmail && profileEmail.includes("@") && !profileEmail.endsWith("@wallet.local");
      const recipientUsername = profile?.username?.trim() || null;

      // Idempotent insert on the subgraph event id — a duplicate insert means
      // this row was already processed by a prior cron run, so skip it.
      const { error: insertError } = await supabase.from("forfeit_friend_rewards").insert({
        id: r.id,
        commitment_id: Number(r.commitmentId),
        recipient_address: recipientAddress,
        recipient_username: recipientUsername,
        recipient_email: hasRealEmail ? profileEmail : null,
        token_address: tokenAddress,
        token_symbol: tokenSymbol,
        amount: amountNum,
        amount_wei: r.amount,
        tx_hash: r.txHash,
        credited_at: new Date(Number(r.createdAt) * 1000).toISOString(),
        email_sent: false,
      });
      if (insertError) continue; // already synced (or a real DB error — either way, not retryable here)
      friendRewardsSynced++;

      if (amountNum > 0) {
        await creditProfileEarnedFromToken({
          address: recipientAddress,
          amount: amountNum,
          tokenAddress,
        });
      }

      const pushResult = await notifyManyRecipients(supabase, [recipientAddress], {
        title: "You received a forfeit reward",
        body: "A friend missed their commitment — their stake is ready for you to claim.",
        url: "/rewards",
        type: "forfeit_friend_reward",
        message: "A friend missed their commitment — their stake is ready for you to claim.",
        eventKeyFor: (addr) => `forfeit_friend_reward:${r.id}:${addr}`,
      });
      friendRewardsNotified += pushResult.sent;

      if (hasRealEmail) {
        const username =
          recipientUsername || `${recipientAddress.slice(0, 6)}…${recipientAddress.slice(-4)}`;
        const amountLabel = amountNum.toLocaleString(undefined, { maximumFractionDigits: 6 });
        try {
          await sendRewardNotificationEmail(profileEmail, {
            username,
            amountLabel,
            tokenSymbol,
            appUrl,
            claimUrl: `${appUrl}/rewards`,
            reason: "a friend's forfeited commitment",
          });
          await supabase
            .from("forfeit_friend_rewards")
            .update({ email_sent: true, email_error: null })
            .eq("id", r.id);
          friendRewardsEmailed++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[forfeit-deadline-check] friend reward email failed for ${r.id}:`, err);
          await supabase
            .from("forfeit_friend_rewards")
            .update({ email_sent: false, email_error: message.slice(0, 500) })
            .eq("id", r.id);
        }
      }
    }

    return jsonResponse({
      ok: true,
      nowSec,
      overdueFound: overdue.length,
      resolved,
      resolveFailed,
      resolveErrors: resolveErrors.length > 0 ? resolveErrors : undefined,
      keeper: keeper ?? undefined,
      recentForfeitedFound: recent.length,
      synced,
      notified,
      friendRewardsFound: friendRewards.length,
      friendRewardsSynced,
      friendRewardsNotified,
      friendRewardsEmailed,
    });
  } catch (e: any) {
    return errorResponse(e?.message ?? "Cron failed", 500);
  }
}
