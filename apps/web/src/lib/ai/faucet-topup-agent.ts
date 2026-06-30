import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkFaucetBalance,
  checkIpRate,
  checkWalletActivity,
  executeRejectClaim,
  executeSendGas,
} from "./faucet-tools";

export type TopupAgentResult =
  | { outcome: "sent"; txHash: string }
  | { outcome: "rejected"; reason: string }
  | { outcome: "error"; error: string };

export async function runTopupAgent(params: {
  claimId: string;
  address: string;
  ip: string;
  supabase: SupabaseClient;
}): Promise<TopupAgentResult> {
  try {
    // 1. Wallet activity — must have at least 10 on-chain txs (proven active user)
    //    and must not have received a top-up in the last 30 days.
    const activity = await checkWalletActivity(params.address, params.supabase);
    if (activity.nonce < 10) {
      await executeRejectClaim("low_nonce", params.claimId, params.supabase);
      return { outcome: "rejected", reason: "low_nonce" };
    }
    if (activity.days_since_last_claim !== null && activity.days_since_last_claim < 30) {
      await executeRejectClaim("too_soon", params.claimId, params.supabase);
      return { outcome: "rejected", reason: "too_soon" };
    }

    // 2. IP rate limit — max 2 sent top-ups from the same IP per 24 hours
    const ipCheck = await checkIpRate(params.ip, params.supabase);
    if (ipCheck.count >= 2) {
      await executeRejectClaim("ip_rate_exceeded", params.claimId, params.supabase);
      return { outcome: "rejected", reason: "ip_rate_exceeded" };
    }

    // 3. Faucet balance sufficient?
    const { balance_celo } = await checkFaucetBalance();
    if (balance_celo < 0.5) {
      await executeRejectClaim("insufficient_faucet_funds", params.claimId, params.supabase);
      return { outcome: "rejected", reason: "insufficient_faucet_funds" };
    }

    // 4. Send 0.3 CELO
    const sendResult = await executeSendGas(
      params.address,
      0.3,
      params.claimId,
      params.supabase,
    );
    if (sendResult.success && sendResult.tx_hash) {
      return { outcome: "sent", txHash: sendResult.tx_hash };
    }
    return { outcome: "error", error: sendResult.error ?? "send_failed" };
  } catch (err) {
    console.error("[faucet-topup-agent] unexpected error:", err);
    return { outcome: "error", error: err instanceof Error ? err.message : "unexpected_error" };
  }
}
