import type { SupabaseClient } from "@supabase/supabase-js";
import { getFaucetBalance, getWalletNonce, sendCelo } from "@/lib/celo/send-celo";

export type ToolContext = {
  claimId: string;
  address: `0x${string}`;
  email: string | null;
  ip: string;
  supabase: SupabaseClient;
};

export type ToolResult = Record<string, unknown>;

/** Check if this wallet has already received gas (status='sent'). */
export async function checkWalletClaim(
  address: string,
  supabase: SupabaseClient,
): Promise<{ already_received: boolean }> {
  const { data } = await supabase
    .from("gas_faucet_claims")
    .select("id")
    .eq("address", address.toLowerCase())
    .eq("status", "sent")
    .maybeSingle();
  return { already_received: !!data };
}

/** Check if this email has already received gas. Skips query when email is null. */
export async function checkEmailClaim(
  email: string | null,
  supabase: SupabaseClient,
): Promise<{ already_received: boolean }> {
  if (!email) return { already_received: false };
  const { data } = await supabase
    .from("gas_faucet_claims")
    .select("id")
    .eq("email", email.toLowerCase())
    .eq("status", "sent")
    .maybeSingle();
  return { already_received: !!data };
}

/** Count claims from this IP in the last 24 hours. */
export async function checkIpRate(
  ip: string,
  supabase: SupabaseClient,
): Promise<{ count: number }> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("gas_faucet_claims")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", cutoff);
  return { count: count ?? 0 };
}

/** Returns the faucet wallet's current CELO balance. */
export async function checkFaucetBalance(): Promise<{ balance_celo: number }> {
  const balance_celo = await getFaucetBalance();
  return { balance_celo };
}

/** Returns the wallet's nonce and days since last faucet claim. */
export async function checkWalletActivity(
  address: string,
  supabase: SupabaseClient,
): Promise<{ nonce: number; days_since_last_claim: number | null }> {
  const [nonce, claimResult] = await Promise.all([
    getWalletNonce(address as `0x${string}`),
    supabase
      .from("gas_faucet_claims")
      .select("created_at")
      .eq("address", address.toLowerCase())
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let days_since_last_claim: number | null = null;
  if (claimResult.data?.created_at) {
    const ms = Date.now() - new Date(claimResult.data.created_at).getTime();
    days_since_last_claim = Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  return { nonce, days_since_last_claim };
}

/** Sends CELO and marks the claim as sent. Returns tx hash on success. */
export async function executeSendGas(
  address: string,
  amountCelo: number,
  claimId: string,
  supabase: SupabaseClient,
): Promise<{ success: boolean; tx_hash?: string; error?: string }> {
  try {
    const txHash = await sendCelo(address as `0x${string}`, amountCelo.toString());

    const { error: dbError } = await supabase
      .from("gas_faucet_claims")
      .update({ status: "sent", tx_hash: txHash, amount_celo: amountCelo })
      .eq("id", claimId);

    if (dbError) {
      // 23505 = unique constraint violation (concurrent race — already sent)
      if (dbError.code === "23505") {
        return { success: false, error: "already_sent_concurrent" };
      }
      console.error("[faucet] DB update after send failed:", dbError);
    }

    return { success: true, tx_hash: txHash };
  } catch (err) {
    console.error("[faucet] sendCelo failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "send_failed" };
  }
}

/** Marks the claim as rejected with a reason. */
export async function executeRejectClaim(
  reason: string,
  claimId: string,
  supabase: SupabaseClient,
): Promise<{ rejected: boolean; reason: string }> {
  await supabase
    .from("gas_faucet_claims")
    .update({ status: "rejected", agent_reasoning: reason })
    .eq("id", claimId);
  return { rejected: true, reason };
}
