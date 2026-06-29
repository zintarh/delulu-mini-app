import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getAuthenticatedWallet } from "@/lib/auth/wallet-session";
import { errorResponse, jsonResponse } from "@/lib/api";
import { runTopupAgent } from "@/lib/ai/faucet-topup-agent";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // 1. Auth
  const address = getAuthenticatedWallet(request);
  if (!address) return errorResponse("Unauthorized", 401);

  // 2. IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const supabase = getSupabaseAdmin();
  if (!supabase) return errorResponse("Database unavailable", 503);

  // 3. Insert pending row
  const { data: claim, error: insertError } = await supabase
    .from("gas_faucet_claims")
    .insert({ address, ip_address: ip, status: "pending" })
    .select("id")
    .single();

  if (insertError) {
    console.error("[faucet/topup] insert error:", insertError);
    return errorResponse("Failed to create claim", 500);
  }

  // 4. Run top-up agent
  const result = await runTopupAgent({
    claimId: claim.id as string,
    address,
    ip,
    supabase,
  });

  if (result.outcome === "sent") {
    return jsonResponse({ success: true, txHash: result.txHash });
  }
  if (result.outcome === "rejected") {
    return jsonResponse({ success: false, reason: result.reason });
  }

  console.error("[faucet/topup] agent error:", result.error);
  return jsonResponse({ success: false, reason: "agent_error" }, { status: 500 });
}
