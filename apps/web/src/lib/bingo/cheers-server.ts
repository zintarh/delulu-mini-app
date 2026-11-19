import { createPublicClient, http, parseUnits } from "viem";
import { celo } from "viem/chains";
import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { matchTransfer } from "@/lib/support/transfer-match";
import { isGoodDollarVerified } from "@/lib/referral/verify-identity";
import { sendPushAndNotification } from "@/lib/push/notify-recipients";
import {
  BEST_CARD_PRIZE_G,
  CONTEST_MIN_PLAYERS,
  LEADERBOARD_SIZE,
  MIN_CHEER_G,
  contestWeek,
  lagosDay,
  nextContestStart,
  scoreCards,
} from "@/lib/bingo/cheers";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const RPC = process.env.NEXT_PUBLIC_CELO_RPC_URL ?? process.env.CELO_RPC_URL ?? "https://forno.celo.org";
const client = createPublicClient({ chain: celo, transport: http(RPC) });
const G = GOODDOLLAR_ADDRESSES.mainnet.toLowerCase();

export class CheerError extends Error {}

/**
 * Records a cheer once its G$ transfer (voter → card owner) is on-chain.
 * Rules: face-verified voters, not your own card, one cheer per card per day,
 * at least 100 G$, during a contest week.
 */
export async function recordCheer(admin: Admin, voter: string, attemptId: string, txHash: `0x${string}`, amount: number) {
  const from = voter.toLowerCase();
  const week = contestWeek();
  if (!week) throw new CheerError("Cheering opens with the next round.");
  if (!(amount >= MIN_CHEER_G)) throw new CheerError(`Cheers start at ${MIN_CHEER_G} G$.`);

  const { data: attempt } = await admin.from("bingo_attempts").select("id, wallet, campaign_id").eq("id", attemptId).maybeSingle();
  if (!attempt) throw new CheerError("Card not found.");
  const to = String(attempt.wallet).toLowerCase();
  if (to === from) throw new CheerError("You can't cheer your own card.");
  if (!(await isGoodDollarVerified(from))) throw new CheerError("Verify once to cheer — it keeps the vote fair.");

  const day = lagosDay(Date.now());
  const { data: dup } = await admin.from("card_cheers").select("id").eq("attempt_id", attemptId).eq("from_wallet", from).eq("lagos_day", day).maybeSingle();
  if (dup) throw new CheerError("You've cheered this card today — come back tomorrow.");

  // The wallet's hash isn't proof: wait for the receipt and match the transfer.
  let receipt = null;
  for (let i = 0; i < 12 && !receipt; i++) {
    receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
    if (!receipt) await new Promise((r) => setTimeout(r, 2_500));
  }
  if (!receipt) throw new CheerError("Still confirming — your cheer will count in a moment. Pull to refresh.");
  if (receipt.status !== "success") throw new CheerError("That transfer failed, nothing was sent.");
  const match = matchTransfer(receipt.logs, { token: G, from, to, amountWei: parseUnits(String(amount), 18) });
  if (!match) throw new CheerError("That transfer doesn't match this cheer.");

  const { error } = await admin.from("card_cheers").insert({
    attempt_id: attemptId,
    campaign_id: attempt.campaign_id,
    from_wallet: from,
    to_wallet: to,
    amount,
    tx_hash: txHash.toLowerCase(),
    week_start: week.start,
    lagos_day: day,
  });
  if (error && !/duplicate|unique/i.test(error.message)) throw error;
  if (error) return; // already counted (a retry) — already notified too

  // Tell the player — best effort, never fails the cheer.
  try {
    const [{ data: voterProfile }, { data: camp }] = await Promise.all([
      admin.from("profiles").select("username").eq("address", from).maybeSingle(),
      admin.from("bingo_campaigns").select("slug, title").eq("id", attempt.campaign_id).maybeSingle(),
    ]);
    const who = voterProfile?.username ? `@${voterProfile.username}` : "Someone";
    const title = `🔥 ${who} cheered your card +${amount.toLocaleString("en-US")} G$`;
    const body = camp?.title ? `${camp.title} — every cheer is a vote for this week's best card.` : "Every cheer is a vote for this week's best card.";
    await sendPushAndNotification({
      supabase: admin,
      recipientAddress: to,
      eventKey: `cheer:${txHash.toLowerCase()}`,
      title,
      body,
      url: camp?.slug ? `/bingo/${camp.slug}#players` : "/explore",
      type: "system",
      message: `**${title}** ${body}`,
    });
  } catch (err) {
    console.error("[cheers] notify failed", err);
  }
}

export type CheerBoardEntry = {
  attemptId: string;
  wallet: string;
  username: string | null;
  avatarUrl: string | null;
  score: number;
  cheers: number;
  voters: number;
  totalG: number;
};

export type CheerContest = {
  live: boolean;
  /** Enough players this week for the prize to run. */
  eligible: boolean;
  players: number;
  minPlayers: number;
  prizeG: number;
  endsAt: string | null;
  nextStart: string | null;
  /** Top cards by cheer score. */
  leaderboard: CheerBoardEntry[];
  /** Every card's score this week (attemptId → score), for the player list. */
  scores: Record<string, { score: number; cheers: number; voters: number }>;
  /** Cards the viewer already cheered today. */
  cheeredToday: string[];
  /** The card_cheers table isn't there yet. */
  setupPending?: boolean;
};

export async function loadCheerContest(admin: Admin, campaignId: string, viewer: string | null): Promise<CheerContest> {
  const week = contestWeek();
  const base: CheerContest = {
    live: !!week,
    eligible: false,
    players: 0,
    minPlayers: CONTEST_MIN_PLAYERS,
    prizeG: BEST_CARD_PRIZE_G,
    endsAt: week?.end ?? null,
    nextStart: nextContestStart(),
    leaderboard: [],
    scores: {},
    cheeredToday: [],
  };
  if (!week) return base;

  const [{ count: players }, cheers] = await Promise.all([
    // Cards running during the week (3-day and 7-day alike).
    admin
      .from("bingo_attempts")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .lt("started_at", new Date(week.end).toISOString())
      .gt("ends_at", new Date(week.start).toISOString()),
    admin.from("card_cheers").select("attempt_id, from_wallet, amount, lagos_day").eq("campaign_id", campaignId).eq("week_start", week.start).limit(20_000),
  ]);
  if (cheers.error && /card_cheers/.test(cheers.error.message)) return { ...base, players: players ?? 0, eligible: (players ?? 0) >= CONTEST_MIN_PLAYERS, setupPending: true };

  const rows = (cheers.data ?? []).map((r) => ({ attemptId: String(r.attempt_id), fromWallet: String(r.from_wallet), amount: Number(r.amount) }));
  const scored = scoreCards(rows);
  const top = scored.slice(0, LEADERBOARD_SIZE);
  const ids = top.map((s) => s.attemptId);
  const { data: owners } = ids.length ? await admin.from("bingo_attempts").select("id, wallet").in("id", ids) : { data: [] as { id: string; wallet: string }[] };
  const ownerOf = new Map((owners ?? []).map((o) => [String(o.id), String(o.wallet).toLowerCase()]));
  const wallets = [...new Set([...ownerOf.values()])];
  const { data: profiles } = wallets.length ? await admin.from("profiles").select("address, username, pfp_url").in("address", wallets) : { data: [] as { address: string; username: string | null; pfp_url: string | null }[] };
  const profile = new Map((profiles ?? []).map((p) => [String(p.address).toLowerCase(), p]));
  const today = lagosDay(Date.now());

  return {
    ...base,
    players: players ?? 0,
    eligible: (players ?? 0) >= CONTEST_MIN_PLAYERS,
    leaderboard: top.map((s) => {
      const w = ownerOf.get(s.attemptId) ?? "";
      const p = profile.get(w);
      return { ...s, wallet: w, username: (p?.username as string) ?? null, avatarUrl: (p?.pfp_url as string) ?? null };
    }),
    scores: Object.fromEntries(scored.map((s) => [s.attemptId, { score: s.score, cheers: s.cheers, voters: s.voters }])),
    cheeredToday: viewer
      ? [...new Set((cheers.data ?? []).filter((r) => r.from_wallet === viewer.toLowerCase() && r.lagos_day === today).map((r) => String(r.attempt_id)))]
      : [],
  };
}
