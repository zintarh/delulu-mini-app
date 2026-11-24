import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requireAuthenticatedWallet, walletAuthErrorResponse } from "@/lib/auth/wallet-session";
import { loadAttempt } from "@/lib/bingo/attempts";
import { BOOST } from "@/lib/bingo/boost";
import { boostsInTx } from "@/lib/bingo/boost-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TX = /^0x[0-9a-f]{64}$/;

/**
 * POST { txHash } — record a Daily Boost once its ForfeitMarket.boostCommitment
 * tx is on-chain: our contract, this card's commitment, this player. The
 * contract already refused anything after the day's photo, so whatever it
 * accepted counts. Retry-safe (tx_hash + log_index is unique).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!BOOST.live) return NextResponse.json({ error: "Boosting isn't open yet." }, { status: 404 });
  let wallet: string;
  try {
    wallet = requireAuthenticatedWallet(request);
  } catch (e) {
    return walletAuthErrorResponse(e);
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const txHash = String(body.txHash ?? "").trim().toLowerCase();
  if (!TX.test(txHash)) return NextResponse.json({ error: "Missing boost transaction." }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const attempt = await loadAttempt(admin, id);
  if (!attempt || attempt.wallet !== wallet) return NextResponse.json({ error: "This Bingo card isn't yours." }, { status: 403 });
  if (attempt.forfeit_commitment_id == null) return NextResponse.json({ error: "Only daily cards can be boosted." }, { status: 400 });

  const found = await boostsInTx(txHash as `0x${string}`);
  if (found === "pending") return NextResponse.json({ error: "Still confirming — try again in a moment.", retryable: true }, { status: 503 });
  if (found === "failed") return NextResponse.json({ error: "That boost didn't go through, nothing was taken." }, { status: 400 });
  const mine = found.filter((b) => b.commitmentId === Number(attempt.forfeit_commitment_id) && b.creator === wallet);
  if (!mine.length) return NextResponse.json({ error: "That transaction isn't a boost on this card." }, { status: 400 });

  const { error } = await admin.from("bingo_boosts").upsert(
    mine.map((b) => ({
      attempt_id: attempt.id,
      wallet,
      commitment_id: b.commitmentId,
      slot_index: b.slot,
      amount: b.amount,
      tx_hash: txHash,
      log_index: b.logIndex,
    })),
    { onConflict: "tx_hash,log_index", ignoreDuplicates: true },
  );
  if (error) {
    console.error("[bingo/boost] record failed", error);
    return NextResponse.json({ error: "Boost is on your card — we'll catch up on it shortly.", retryable: true }, { status: 503 });
  }
  return NextResponse.json({ ok: true, boosted: mine.reduce((n, b) => n + b.amount, 0) });
}
