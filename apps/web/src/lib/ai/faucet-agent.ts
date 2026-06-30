import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkEmailClaim,
  checkFaucetBalance,
  checkIpRate,
  checkWalletClaim,
  executeRejectClaim,
  executeSendGas,
} from "./faucet-tools";

export type FaucetAgentResult =
  | { outcome: "sent"; txHash: string }
  | { outcome: "rejected"; reason: string }
  | { outcome: "error"; error: string };

export async function runFaucetAgent(params: {
  claimId: string;
  address: string;
  email: string | null;
  ip: string;
  supabase: SupabaseClient;
}): Promise<FaucetAgentResult> {
  console.log("[faucet-agent] start", { claimId: params.claimId, address: params.address, email: params.email, ip: params.ip });
  try {
    // 1. Wallet already claimed?
    const walletCheck = await checkWalletClaim(params.address, params.supabase);
    console.log("[faucet-agent] wallet check:", walletCheck);
    if (walletCheck.already_received) {
      await executeRejectClaim("already_received_wallet", params.claimId, params.supabase);
      return { outcome: "rejected", reason: "already_received_wallet" };
    }

    // 2. Email already claimed?
    const emailCheck = await checkEmailClaim(params.email, params.supabase);
    console.log("[faucet-agent] email check:", emailCheck);
    if (emailCheck.already_received) {
      await executeRejectClaim("already_received_email", params.claimId, params.supabase);
      return { outcome: "rejected", reason: "already_received_email" };
    }

    // 3. IP rate limit
    const ipCheck = await checkIpRate(params.ip, params.supabase);
    console.log("[faucet-agent] ip check:", ipCheck);
    if (ipCheck.count >= 3) {
      await executeRejectClaim("ip_rate_exceeded", params.claimId, params.supabase);
      return { outcome: "rejected", reason: "ip_rate_exceeded" };
    }

    // 4. Faucet balance sufficient?
    const { balance_celo } = await checkFaucetBalance();
    console.log("[faucet-agent] faucet balance:", balance_celo, "CELO — threshold 0.6");
    if (balance_celo < 0.6) {
      await executeRejectClaim("insufficient_faucet_funds", params.claimId, params.supabase);
      return { outcome: "rejected", reason: "insufficient_faucet_funds" };
    }

    // 5. Send 0.5 CELO
    console.log("[faucet-agent] sending 0.5 CELO to", params.address);
    const sendResult = await executeSendGas(
      params.address,
      0.5,
      params.claimId,
      params.supabase,
    );
    console.log("[faucet-agent] send result:", sendResult);
    if (sendResult.success && sendResult.tx_hash) {
      return { outcome: "sent", txHash: sendResult.tx_hash };
    }
    return { outcome: "error", error: sendResult.error ?? "send_failed" };
  } catch (err) {
    console.error("[faucet-agent] unexpected error:", err);
    return { outcome: "error", error: err instanceof Error ? err.message : "unexpected_error" };
  }
}
