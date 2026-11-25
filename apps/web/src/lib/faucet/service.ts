import { formatGwei, type Hash } from "viem";
import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { loadFaucetConfig } from "@/lib/faucet/config";
import {
  broadcastCelo,
  currentMaxFeePerGas,
  faucetAccount,
  faucetPublicClient,
  hasOnChainProfile,
  receiptStatus,
  outgoingCeloSince,
  txKnown,
  waitForReceipt,
} from "@/lib/faucet/chain";
import {
  applyComfortFloor,
  COMFORT_BALANCE_CELO,
  computeTopUp,
  gasReasonMessage,
  ipSubnet,
  sentSponsoredGasOut,
  weiToCelo,
  type FaucetConfig,
  type FaucetStage,
  type GasRequestReason,
} from "@/lib/faucet/rules";
import { captchaEnabled, verifyCaptcha } from "@/lib/faucet/turnstile";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export type GasResult = {
  success: boolean;
  reason?: GasRequestReason;
  /** User-facing line for anything but a plain success. */
  message?: string;
  stage?: FaucetStage;
  txHash?: string;
  amountCelo?: number;
  /** Broadcast but not confirmed within the request; it settles in the background. */
  pending?: boolean;
};

const RECEIPT_WAIT_MS = 25_000;

function fail(reason: GasRequestReason, stage?: FaucetStage): GasResult {
  return { success: false, reason, message: gasReasonMessage(reason), stage };
}

/** Refusals worth keeping for abuse analytics (not "already has enough" or "in flight"). */
const LOGGED: GasRequestReason[] = [
  "blocked",
  "captcha_failed",
  "captcha_required",
  "not_eligible",
  "sent_out",
  "stage_cap",
  "ip_limit",
  "subnet_limit",
  "daily_budget",
  "faucet_empty",
  "gas_too_high",
];

async function logRejection(
  admin: SupabaseAdmin,
  row: { address: string; stage: FaucetStage | null; ip: string | null; subnet: string | null; reason: GasRequestReason },
) {
  if (!LOGGED.includes(row.reason)) return;
  const { error } = await admin.from("gas_faucet_claims").insert({
    address: row.address,
    stage: row.stage,
    ip_address: row.ip,
    ip_subnet: row.subnet,
    status: "rejected",
    agent_reasoning: row.reason,
  });
  if (error) console.error("[faucet] could not log rejection", error);
}

async function isBlocked(admin: SupabaseAdmin, address: string, ip: string | null, subnet: string | null) {
  // Address, IP and subnet values never look alike, so one `in` covers all three kinds.
  const values = [address, ip, subnet].filter((v): v is string => Boolean(v));
  const { data, error } = await admin.from("faucet_blocklist").select("id").in("value", values).limit(1);
  if (error) throw new Error(`[faucet] blocklist: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * A wallet that already received gas and then transferred CELO out cannot
 * claim again. "known" means we already recorded that. "new" means this
 * request is the one that found the transfer. null means they may still claim.
 * A failed history lookup does not block them.
 */
async function withdrewSponsoredGas(admin: SupabaseAdmin, address: `0x${string}`): Promise<"known" | "new" | null> {
  const { data: marked, error: markedError } = await admin
    .from("gas_faucet_claims")
    .select("id")
    .eq("address", address)
    .eq("agent_reasoning", "sent_out")
    .limit(1);
  if (markedError) throw new Error(`[faucet] sent-out check: ${markedError.message}`);
  if ((marked?.length ?? 0) > 0) return "known";

  const { data: sent, error } = await admin
    .from("gas_faucet_claims")
    .select("tx_hash")
    .eq("address", address)
    .eq("status", "sent")
    .not("tx_hash", "is", null)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(`[faucet] prior drip: ${error.message}`);
  const hash = sent?.[0]?.tx_hash as Hash | undefined;
  if (!hash) return null;

  try {
    const receipt = await faucetPublicClient.getTransactionReceipt({ hash });
    const outgoing = await outgoingCeloSince(address, receipt.blockNumber);
    if (!outgoing) return null;
    return sentSponsoredGasOut(outgoing, address) ? "new" : null;
  } catch (err) {
    console.error("[faucet] could not check whether gas was sent out", err);
    return null;
  }
}

/** CELO this wallet has used of a step (in flight or sent), optionally within a window. */
async function stageUsed(admin: SupabaseAdmin, address: string, stage: FaucetStage, windowDays?: number) {
  let q = admin
    .from("gas_faucet_claims")
    .select("amount_celo")
    .eq("address", address)
    .in("status", ["pending", "submitted", "sent"])
    .in("stage", stage === "signup" ? ["signup", "legacy"] : [stage]);
  if (windowDays) q = q.gte("created_at", new Date(Date.now() - windowDays * 86_400_000).toISOString());
  const { data, error } = await q;
  if (error) throw new Error(`[faucet] stage usage: ${error.message}`);
  return (data ?? []).reduce((sum, r) => sum + Number(r.amount_celo ?? 0), 0);
}

/** Approved proofs in the window: reviewed proofs plus kept Forfeit days (self-verified ones are still real on-chain use). */
async function recentProofCount(admin: SupabaseAdmin, address: string, days: number): Promise<number> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [reviewed, commitments] = await Promise.all([
    admin
      .from("proof_rewards")
      .select("id", { count: "exact", head: true })
      .eq("wallet", address)
      .not("verified_at", "is", null)
      .gte("verified_at", since),
    admin.from("forfeit_commitments").select("id").eq("creator_wallet", address).limit(500),
  ]);
  if (reviewed.error) throw new Error(`[faucet] proof count: ${reviewed.error.message}`);
  let kept = 0;
  const ids = (commitments.data ?? []).map((c) => c.id as string);
  if (ids.length > 0) {
    const { count, error } = await admin
      .from("forfeit_periods")
      .select("id", { count: "exact", head: true })
      .in("commitment_id", ids)
      .not("tx_hash", "is", null)
      .gte("resolved_at", since)
      .not("verifier_action", "in", "(rejected,timed_out)");
    if (error) throw new Error(`[faucet] kept days: ${error.message}`);
    kept = count ?? 0;
  }
  return (reviewed.count ?? 0) + kept;
}

type Plan = { stage: FaucetStage; capCelo: number; windowDays?: number; gasUnits: number; maxPerDripCelo: number };

/**
 * Which step this wallet is on, from facts we check ourselves (never the
 * client's word): no on-chain profile → signup; profile and starter budget
 * left → starter; otherwise active, if it has recent approved proofs.
 */
async function planFor(admin: SupabaseAdmin, address: `0x${string}`, config: FaucetConfig): Promise<Plan | null> {
  const { signup, starter, active } = config.stages;
  if (!(await hasOnChainProfile(address))) {
    return { stage: "signup", capCelo: signup.capCelo, gasUnits: signup.gasUnits, maxPerDripCelo: signup.maxPerDripCelo };
  }
  if ((await stageUsed(admin, address, "starter")) < starter.capCelo) {
    return { stage: "starter", capCelo: starter.capCelo, gasUnits: starter.gasUnits, maxPerDripCelo: starter.maxPerDripCelo };
  }
  if ((await recentProofCount(admin, address, active.proofWindowDays)) >= active.minProofs) {
    return {
      stage: "active",
      capCelo: active.capCelo,
      windowDays: active.windowDays,
      gasUnits: active.gasUnits,
      maxPerDripCelo: active.maxPerDripCelo,
    };
  }
  return null;
}

/**
 * Sends a wallet just enough gas for its next step, if it qualifies.
 * Idempotent per wallet: while one drip is in flight, others return in_flight.
 */
export async function requestGas(
  admin: SupabaseAdmin,
  params: { address: `0x${string}`; ip: string | null; captchaToken?: string | null },
): Promise<GasResult> {
  const address = params.address.toLowerCase() as `0x${string}`;
  const ip = params.ip;
  const subnet = ipSubnet(ip);
  const config = await loadFaucetConfig(admin);
  if (!config.enabled) return fail("paused");

  if (await isBlocked(admin, address, ip, subnet)) {
    await logRejection(admin, { address, stage: null, ip, subnet, reason: "blocked" });
    return fail("blocked");
  }

  // Settle this wallet's earlier drip first, so a crashed request never
  // blocks it for long and a confirmed one counts.
  await reconcileFaucetClaims(admin, { address });

  const withdrew = await withdrewSponsoredGas(admin, address);
  if (withdrew) {
    if (withdrew === "new") await logRejection(admin, { address, stage: null, ip, subnet, reason: "sent_out" });
    return fail("sent_out");
  }

  let plan: Plan | null;
  let balanceWei: bigint;
  let maxFee: bigint;
  try {
    [plan, balanceWei, maxFee] = await Promise.all([
      planFor(admin, address, config),
      faucetPublicClient.getBalance({ address }),
      currentMaxFeePerGas(),
    ]);
  } catch (err) {
    console.error("[faucet] could not read chain state", err);
    return fail("unavailable");
  }
  if (!plan) {
    await logRejection(admin, { address, stage: null, ip, subnet, reason: "not_eligible" });
    return fail("not_eligible");
  }

  const priced = computeTopUp({ gasUnits: plan.gasUnits, maxFeePerGasWei: maxFee, margin: config.gasMargin, balanceWei });
  // Fee math alone is ~0.06 CELO. Top the wallet up to 0.6 so the next stake can be sent.
  const needWei = applyComfortFloor(priced.needWei, balanceWei, COMFORT_BALANCE_CELO);
  if (needWei === 0n) return { success: true, reason: "has_enough", stage: plan.stage };
  const amountCelo = weiToCelo(needWei);
  if (amountCelo > plan.maxPerDripCelo) {
    await logRejection(admin, { address, stage: plan.stage, ip, subnet, reason: "gas_too_high" });
    return fail("gas_too_high", plan.stage);
  }

  // Bots come in at signup; later steps already need a real on-chain profile.
  if (plan.stage === "signup" && config.requireCaptcha && captchaEnabled()) {
    if (!params.captchaToken) return fail("captcha_required", plan.stage);
    if (!(await verifyCaptcha(params.captchaToken, ip))) {
      await logRejection(admin, { address, stage: plan.stage, ip, subnet, reason: "captcha_failed" });
      return fail("captcha_failed", plan.stage);
    }
  }

  let faucetWei: bigint;
  try {
    faucetWei = await faucetPublicClient.getBalance({ address: faucetAccount().address });
  } catch (err) {
    console.error("[faucet] faucet balance unavailable", err);
    return fail("unavailable", plan.stage);
  }
  if (weiToCelo(faucetWei) < amountCelo + config.limits.minReserveCelo) {
    await logRejection(admin, { address, stage: plan.stage, ip, subnet, reason: "faucet_empty" });
    return fail("faucet_empty", plan.stage);
  }

  const { data: reserved, error: reserveError } = await admin.rpc("faucet_reserve", {
    p_address: address,
    p_stage: plan.stage,
    p_amount: amountCelo,
    p_ip: ip,
    p_subnet: subnet,
    p_stage_cap: plan.capCelo,
    p_window_hours: plan.windowDays ? plan.windowDays * 24 : null,
    p_ip_limit: config.limits.signupsPerIpPerDay,
    p_subnet_limit: config.limits.signupsPerSubnetPerDay,
    p_daily_budget: config.limits.dailyBudgetCelo,
    p_gas_price_gwei: Number(formatGwei(maxFee)),
    p_balance_before: weiToCelo(balanceWei),
  });
  if (reserveError) {
    console.error("[faucet] reserve failed", reserveError);
    return fail("unavailable", plan.stage);
  }
  const res = reserved as { outcome: string; id?: string };
  if (res.outcome !== "reserved" || !res.id) {
    const reason = res.outcome as GasRequestReason;
    await logRejection(admin, { address, stage: plan.stage, ip, subnet, reason });
    return fail(reason, plan.stage);
  }

  let hash: Hash;
  try {
    hash = await broadcastCelo(address, needWei);
  } catch (err) {
    console.error("[faucet] broadcast failed", err);
    await admin
      .from("gas_faucet_claims")
      .update({ status: "failed", agent_reasoning: `send_failed: ${String(err instanceof Error ? err.message : err).slice(0, 200)}` })
      .eq("id", res.id);
    return fail("send_failed", plan.stage);
  }

  // Save the hash before waiting, so a timeout can still be settled later.
  const { error: saveError } = await admin
    .from("gas_faucet_claims")
    .update({ status: "submitted", tx_hash: hash, submitted_at: new Date().toISOString() })
    .eq("id", res.id);
  if (saveError) console.error("[faucet] could not save tx hash", hash, saveError);

  const status = await waitForReceipt(hash, RECEIPT_WAIT_MS);
  if (status === "success") {
    await admin
      .from("gas_faucet_claims")
      .update({ status: "sent", confirmed_at: new Date().toISOString() })
      .eq("id", res.id);
    return { success: true, stage: plan.stage, txHash: hash, amountCelo };
  }
  if (status === "reverted") {
    await admin.from("gas_faucet_claims").update({ status: "failed", agent_reasoning: "reverted" }).eq("id", res.id);
    return fail("send_failed", plan.stage);
  }
  return { success: true, stage: plan.stage, txHash: hash, amountCelo, pending: true };
}

/**
 * Settles drips a request didn't finish: confirmed → sent, reverted or
 * dropped → failed (releasing the reservation), and pending rows whose
 * request died before broadcasting → failed. Idempotent; safe to run often.
 */
export async function reconcileFaucetClaims(
  admin: SupabaseAdmin,
  opts: { address?: string; limit?: number } = {},
): Promise<{ settled: number }> {
  let settled = 0;
  const staleCutoff = new Date(Date.now() - 3 * 60_000).toISOString();

  let stale = admin
    .from("gas_faucet_claims")
    .update({ status: "failed", agent_reasoning: "stale_pending" })
    .eq("status", "pending")
    .is("tx_hash", null)
    .lt("created_at", staleCutoff);
  if (opts.address) stale = stale.eq("address", opts.address);
  const { data: staleRows } = await stale.select("id");
  settled += staleRows?.length ?? 0;

  let q = admin
    .from("gas_faucet_claims")
    .select("id, tx_hash, submitted_at, created_at")
    .eq("status", "submitted")
    .not("tx_hash", "is", null)
    .order("created_at", { ascending: true })
    .limit(opts.limit ?? 50);
  if (opts.address) q = q.eq("address", opts.address);
  const { data: rows } = await q;

  for (const r of rows ?? []) {
    const hash = r.tx_hash as Hash;
    const status = await receiptStatus(hash);
    if (status === "success") {
      await admin.from("gas_faucet_claims").update({ status: "sent", confirmed_at: new Date().toISOString() }).eq("id", r.id);
      settled++;
    } else if (status === "reverted") {
      await admin.from("gas_faucet_claims").update({ status: "failed", agent_reasoning: "reverted" }).eq("id", r.id);
      settled++;
    } else {
      const since = new Date((r.submitted_at as string | null) ?? (r.created_at as string)).getTime();
      if (Date.now() - since > 10 * 60_000 && !(await txKnown(hash))) {
        await admin.from("gas_faucet_claims").update({ status: "failed", agent_reasoning: "dropped" }).eq("id", r.id);
        settled++;
      }
    }
  }
  return { settled };
}
