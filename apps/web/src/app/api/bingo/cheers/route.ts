import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requireAuthenticatedWallet, walletAuthErrorResponse } from "@/lib/auth/wallet-session";
import { CheerError, recordCheer } from "@/lib/bingo/cheers-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { attemptId, txHash, amount } — count a cheer once its G$ transfer is on-chain. */
export async function POST(request: NextRequest) {
  let wallet: string;
  try {
    wallet = requireAuthenticatedWallet(request);
  } catch (e) {
    return walletAuthErrorResponse(e);
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const attemptId = String(body.attemptId ?? "");
  const txHash = String(body.txHash ?? "").toLowerCase();
  const amount = Number(body.amount);
  if (!attemptId || !/^0x[0-9a-f]{64}$/.test(txHash)) return NextResponse.json({ error: "Missing cheer details." }, { status: 400 });
  try {
    await recordCheer(admin, wallet, attemptId, txHash as `0x${string}`, amount);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CheerError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[cheers] record failed", e);
    return NextResponse.json({ error: "Couldn't count that cheer — try again in a moment." }, { status: 500 });
  }
}
