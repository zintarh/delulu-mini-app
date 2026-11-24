import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requireAuthenticatedWallet, walletAuthErrorResponse } from "@/lib/auth/wallet-session";
import { loadAttempt } from "@/lib/bingo/attempts";
import { finishDayAsVerifier, isServerVerified } from "@/lib/bingo/server-verify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });

/**
 * Server-verified (3-day) cards: after the player has signed today's proof on
 * ForfeitMarket themselves, Delulu's verifier marks the day done. Only finishes
 * a photo the AI already approved (square in "confirming"), so it can't be used
 * to skip review. The player's signature is best effort: if they cancelled it,
 * the day is still finished — it just isn't their own on-chain activity.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let wallet: string;
  try {
    wallet = requireAuthenticatedWallet(request);
  } catch (e) {
    return walletAuthErrorResponse(e);
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const squareIndex = Number(body.squareIndex);
  if (!Number.isInteger(squareIndex)) return bad("Missing square.");

  const admin = getSupabaseAdmin();
  if (!admin) return bad("DB unavailable", 500);

  const attempt = await loadAttempt(admin, id);
  if (!attempt || attempt.wallet !== wallet) return bad("This Bingo card isn't yours.", 403);
  if (attempt.cycle_id != null || attempt.forfeit_commitment_id == null) return bad("This card doesn't need this step.");

  const { data: square } = await admin
    .from("bingo_squares")
    .select("status")
    .eq("attempt_id", attempt.id)
    .eq("square_index", squareIndex)
    .maybeSingle();
  if (!square) return bad("Submit a photo for this square first.", 404);
  if (square.status === "filled") return NextResponse.json({ filled: true });
  if (square.status !== "confirming") return bad("Submit a photo for this square first.", 409);

  if (!(await isServerVerified(Number(attempt.forfeit_commitment_id)).catch(() => false))) {
    return bad("This card doesn't need this step.");
  }

  try {
    await finishDayAsVerifier(admin, { attemptId: attempt.id, squareIndex });
  } catch (e) {
    console.error("[bingo/finish-day] server finish failed", e);
    return bad("Your photo is approved — we're saving your day. It'll show in a few minutes.", 503, { code: "finishing" });
  }
  const { data: fresh } = await admin.from("bingo_attempts").select("squares_filled, required_filled").eq("id", attempt.id).single();
  return NextResponse.json({ filled: true, squaresFilled: fresh?.squares_filled ?? null, requiredFilled: fresh?.required_filled ?? null });
}
