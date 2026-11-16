import { NextRequest } from "next/server";
import { getAddress } from "viem";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getAuthenticatedWallet } from "@/lib/auth/wallet-session";
import { errorResponse, jsonResponse } from "@/lib/api";
import { requestGas } from "@/lib/faucet/service";
import { clientIp } from "@/lib/faucet/rules";

/**
 * Shared by /api/faucet/claim (signup "skip the face check") and
 * /api/faucet/topup (no-gas modal, onboarding). The server decides the step
 * from on-chain state, so both behave the same: the wallet gets just enough
 * for what it's about to do, or a reason why not.
 *
 * Body (optional): { captchaToken?: string }
 * 200 { success, reason?, message?, stage?, txHash?, amountCelo?, pending? }
 */
export async function handleGasRequest(request: NextRequest) {
  // Address from the signed session cookie only — never from the body.
  const session = getAuthenticatedWallet(request);
  if (!session) return errorResponse("Unauthorized", 401);
  const admin = getSupabaseAdmin();
  if (!admin) return errorResponse("Database unavailable", 503);

  const body = (await request.json().catch(() => ({}))) as { captchaToken?: unknown };
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : null;

  try {
    const result = await requestGas(admin, {
      address: getAddress(session),
      ip: clientIp(request.headers),
      captchaToken,
    });
    return jsonResponse(result);
  } catch (err) {
    console.error("[faucet] request failed", err);
    return jsonResponse(
      { success: false, reason: "unavailable", message: "Couldn't send gas right now. Try again." },
      { status: 500 },
    );
  }
}
