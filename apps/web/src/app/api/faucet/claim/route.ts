import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getAuthenticatedWallet } from "@/lib/auth/wallet-session";
import { errorResponse, jsonResponse } from "@/lib/api";
import { runFaucetAgent } from "@/lib/ai/faucet-agent";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // 1. Auth — address comes from session cookie only (cannot be spoofed by client)
  const address = getAuthenticatedWallet(request);
  if (!address) return errorResponse("Unauthorized", 401);

  // 2. IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const supabase = getSupabaseAdmin();
  if (!supabase) return errorResponse("Database unavailable", 503);

  console.log("[faucet/claim] request from address:", address, "ip:", ip);

  // 3. Look up email — may be null if profile row doesn't exist yet
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("address", address)
    .maybeSingle();
  const email = profile?.email ?? null;
  console.log("[faucet/claim] profile email:", email);

  // 4. Pre-flight: if a sent record already exists, skip the agent entirely
  const { data: existing } = await supabase
    .from("gas_faucet_claims")
    .select("id")
    .eq("address", address)
    .eq("status", "sent")
    .maybeSingle();

  if (existing) {
    return jsonResponse({ success: false, reason: "already_received_wallet" });
  }

  // 5. Insert a pending row — captures the attempt for analytics and acts as a
  //    soft mutex against concurrent requests (unique index on sent rows is the hard one)
  const { data: claim, error: insertError } = await supabase
    .from("gas_faucet_claims")
    .insert({ address, email, ip_address: ip, status: "pending" })
    .select("id")
    .single();

  if (insertError) {
    // 23505 = unique violation — concurrent request already inserted a sent row
    if (insertError.code === "23505") {
      return jsonResponse({ success: false, reason: "already_received_wallet" });
    }
    console.error("[faucet/claim] insert error:", insertError);
    return errorResponse("Failed to create claim", 500);
  }

  // 6. Run the GPT-4o agent
  const result = await runFaucetAgent({
    claimId: claim.id as string,
    address,
    email,
    ip,
    supabase,
  });

  // 7. Map agent result to response
  if (result.outcome === "sent") {
    return jsonResponse({ success: true, txHash: result.txHash });
  }
  if (result.outcome === "rejected") {
    return jsonResponse({ success: false, reason: result.reason });
  }

  console.error("[faucet/claim] agent error:", result.error);
  return jsonResponse({ success: false, reason: "agent_error" }, { status: 500 });
}
