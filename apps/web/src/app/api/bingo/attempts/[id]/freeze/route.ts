import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, decodeEventLog, http, keccak256, parseUnits, toHex } from "viem";
import { celo } from "viem/chains";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requireAuthenticatedWallet, walletAuthErrorResponse } from "@/lib/auth/wallet-session";
import { loadAttempt, recountAttempt } from "@/lib/bingo/attempts";
import { daySlot } from "@/lib/bingo/types";
import { readPeriodOutcome } from "@/lib/bingo/rolling";
import { isServerVerified } from "@/lib/bingo/server-verify";
import { resolveCommitmentSuccessAsKeeper } from "@/lib/celo/forfeit-keeper";
import { REWARD_VAULT_ABI } from "@/lib/abi/reward-vault";
import { CELO_MAINNET_ID, getRewardVaultAddress } from "@/lib/constant";
import { STREAK_FREEZE_G, freezeRef } from "@/lib/bingo/freeze";
import { logBingoEvent } from "@/lib/bingo/cycles";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const err = (error: string, status: number, extra?: Record<string, unknown>) => NextResponse.json({ error, ...extra }, { status });
const STREAK_FREEZE_KIND = keccak256(toHex("STREAK_FREEZE"));

/** GET → whether today's square can be frozen, the price and the `ref` to pay with. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let wallet: string;
  try { wallet = requireAuthenticatedWallet(request); } catch (e) { return walletAuthErrorResponse(e); }
  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return err("Something went wrong on our side.", 500);
  const check = await freezable(admin, id, wallet);
  if ("error" in check) return NextResponse.json({ available: false, reason: check.error });
  return NextResponse.json({ available: true, price: STREAK_FREEZE_G, ref: check.ref, day: check.slot + 1 });
}

/**
 * POST { txHash } — the player paid the streak freeze into the reward pot
 * (RewardVault.purchase, on-chain). We check that payment, then Delulu's
 * verifier keeps today's day alive on-chain. The day counts toward finishing
 * the card but earns no photo reward. One freeze per card.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let wallet: string;
  try { wallet = requireAuthenticatedWallet(request); } catch (e) { return walletAuthErrorResponse(e); }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const txHash = String(body.txHash ?? "");
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return err("Missing payment.", 400);
  const admin = getSupabaseAdmin();
  if (!admin) return err("Something went wrong on our side.", 500);

  const check = await freezable(admin, id, wallet);
  if ("error" in check) return err(check.error ?? "Freeze isn't available.", 409);

  // The payment: a Purchased event from the vault, by this wallet, for this card's day, at the price.
  const client = createPublicClient({ chain: celo, transport: http(process.env.NEXT_PUBLIC_RPC_URL ?? "https://forno.celo.org") });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 60_000 }).catch(() => null);
  if (!receipt || receipt.status !== "success") return err("We couldn't find that payment yet. Try again in a moment.", 409);
  const vault = getRewardVaultAddress(CELO_MAINNET_ID).toLowerCase();
  const paid = receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== vault) return false;
    try {
      const ev = decodeEventLog({ abi: REWARD_VAULT_ABI, data: log.data, topics: log.topics });
      if (ev.eventName !== "Purchased") return false;
      const a = ev.args as { user: string; amount: bigint; kind: string; ref: string };
      return a.user.toLowerCase() === wallet && a.kind === STREAK_FREEZE_KIND && a.ref === check.ref && a.amount >= parseUnits(String(STREAK_FREEZE_G), 18);
    } catch { return false; }
  });
  if (!paid) return err("That payment isn't a streak freeze for this card.", 400);

  const resolveTx = await resolveCommitmentSuccessAsKeeper(BigInt(check.onChainId));
  const now = new Date().toISOString();
  const { error } = await admin.from("bingo_squares").upsert(
    { attempt_id: id, square_index: check.slot, slot_index: check.slot, bonus: false, proof_url: `freeze:${txHash}`, status: "filled", proof_tx: resolveTx, approved_at: now, filled_at: now },
    { onConflict: "attempt_id,square_index" },
  );
  if (error) console.error("[bingo/freeze] square save failed", id, error.message);
  await logBingoEvent(admin, { campaignId: check.campaignId, kind: "streak_freeze", tx: txHash, detail: `attempt ${id} day ${check.slot + 1} · resolved ${resolveTx}` }).catch(() => {});
  await recountAttempt(admin, id);
  return NextResponse.json({ ok: true, resolveTx, day: check.slot + 1 });
}

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

async function freezable(admin: Admin, attemptId: string, wallet: string) {
  const attempt = await loadAttempt(admin, attemptId);
  if (!attempt || attempt.wallet !== wallet) return { error: "This Bingo card isn't yours." } as const;
  if (attempt.cycle_id != null || !attempt.forfeit_commitment_id) return { error: "Streak freeze works on your own Bingo cards." } as const;
  if (attempt.status !== "active") return { error: "This card has ended." } as const;
  const onChainId = Number(attempt.forfeit_commitment_id);
  if (!(await isServerVerified(onChainId))) return { error: "This card is too old for a freeze." } as const;
  const slot = daySlot(attempt.started_at, attempt.ends_at);
  if (slot == null) return { error: "This card has ended." } as const;
  if (slot === 0) return { error: "You can't freeze day 1." } as const;
  const { data: squares } = await admin.from("bingo_squares").select("square_index, status, proof_url").eq("attempt_id", attemptId);
  if ((squares ?? []).some((s) => String(s.proof_url ?? "").startsWith("freeze:"))) return { error: "You've used this card's freeze." } as const;
  if ((squares ?? []).some((s) => s.square_index === slot && s.status === "filled")) return { error: "Today is already done." } as const;
  if ((await readPeriodOutcome(onChainId, slot)) !== 0) return { error: "Today is already settled." } as const;
  return { onChainId, slot, ref: freezeRef(onChainId, slot), campaignId: String(attempt.campaign_id) } as const;
}
