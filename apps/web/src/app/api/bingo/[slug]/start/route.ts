import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requireAuthenticatedWallet, walletAuthErrorResponse } from "@/lib/auth/wallet-session";
import { startRollingAttempt } from "@/lib/bingo/rolling";
import type { BingoCampaignRow } from "@/lib/bingo/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Rolling Bingos: open a personal card from the player's verified stake tx. Retry-safe. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  let wallet: string;
  try {
    wallet = requireAuthenticatedWallet(request);
  } catch (e) {
    return walletAuthErrorResponse(e);
  }
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));
  const txHash = String(body.txHash ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(txHash)) return NextResponse.json({ error: "Missing stake transaction." }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const { data: campaign } = await admin.from("bingo_campaigns").select("*").eq("slug", slug).maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Bingo not found" }, { status: 404 });

  try {
    const attemptId = await startRollingAttempt(admin, campaign as BingoCampaignRow, wallet, txHash as `0x${string}`);
    return NextResponse.json({ ok: true, attemptId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Couldn't start your card.";
    // Syncing is retryable; the stake is already safe on-chain.
    return NextResponse.json({ error: msg, retryable: /syncing|indexed|try again/i.test(msg) }, { status: /syncing/i.test(msg) ? 503 : 400 });
  }
}
