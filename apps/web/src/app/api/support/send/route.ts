import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requireAuthenticatedWallet, walletAuthErrorResponse } from "@/lib/auth/wallet-session";
import { SupportError, createSupportIntent, intentDto } from "@/lib/support/service";

export const dynamic = "force-dynamic";

/**
 * Step 1 of supporting: validate and record the intent before the wallet signs.
 * Body: { deluluId, amount, clientRequestId }. Idempotent per clientRequestId.
 */
export async function POST(request: NextRequest) {
  let supporter: string;
  try {
    supporter = requireAuthenticatedWallet(request);
  } catch (err) {
    return walletAuthErrorResponse(err);
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable", retryable: true }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const onChainId = Number(body.deluluId);
  if (!Number.isInteger(onChainId) || onChainId < 0) {
    return NextResponse.json({ error: "Invalid Delulu" }, { status: 400 });
  }
  try {
    const row = await createSupportIntent(admin, {
      supporter,
      onChainId,
      amount: String(body.amount ?? ""),
      clientRequestId: String(body.clientRequestId ?? ""),
    });
    return NextResponse.json(intentDto(row));
  } catch (err) {
    if (err instanceof SupportError) {
      return NextResponse.json({ error: err.message, retryable: err.retryable }, { status: err.status });
    }
    console.error("[support/send] intent failed", err);
    return NextResponse.json({ error: "Something went wrong", retryable: true }, { status: 500 });
  }
}
