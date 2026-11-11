import { createPublicClient, createWalletClient, formatEther, formatUnits, http, keccak256, parseAbiItem, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { REWARD_VAULT_ABI } from "@/lib/abi/reward-vault";
import { GOODDOLLAR_ADDRESSES, getRewardVaultAddress, CELO_MAINNET_ID } from "@/lib/constant";
import { parseTokenAmount } from "@/lib/token-amounts";

/**
 * Same server wallet as the CELO gas faucet and forfeit-keeper
 * (send-celo.ts, forfeit-keeper.ts) — already the RewardVault owner/rewarder
 * on Celo mainnet, so no separate rewarder grant is needed. It only pays gas:
 * reward G$ comes out of the vault's own pre-funded pool, not this wallet.
 */
function getRewarderAccount() {
  const raw = process.env.CELO_FAUCET_PRIVATE_KEY;
  if (!raw) throw new Error("CELO_FAUCET_PRIVATE_KEY is not configured");
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
  return privateKeyToAccount(key);
}

function getRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CELO_RPC_URL ??
    process.env.NEXT_PUBLIC_RPC_URL ??
    "https://forno.celo.org"
  );
}

/** Deterministic per-referral rewardId, stable across retries so a repeated call can't double-credit on-chain. */
export function referralRewardId(referralCreditId: string): `0x${string}` {
  return keccak256(toHex(`referral-credit:${referralCreditId}`));
}

/** Deterministic per-wallet rewardId for the one-time onboarding gift — one ever, per wallet. */
export function onboardingGiftRewardId(wallet: `0x${string}`): `0x${string}` {
  return keccak256(toHex(`onboarding-gift:${wallet.toLowerCase()}`));
}

/** Deterministic per-proof rewardId — one reward per on-chain proof tx, ever. */
export function proofRewardRewardId(proofTxHash: `0x${string}`): `0x${string}` {
  return keccak256(toHex(`proof-reward:${proofTxHash.toLowerCase()}`));
}

export type VaultDepositResult = {
  txHash: `0x${string}` | null;
  amountWei: string;
  rewardId: `0x${string}`;
  alreadyUsed: boolean;
};

export type ReferralPayoutResult = VaultDepositResult;

function vaultPublicClient() {
  return createPublicClient({ chain: celo, transport: http(getRpcUrl()) });
}

/** Whether RewardVault has already consumed `rewardId` — i.e. that reward was credited on-chain. */
export async function isRewardIdUsed(rewardId: `0x${string}`): Promise<boolean> {
  return (await vaultPublicClient().readContract({
    address: getRewardVaultAddress(CELO_MAINNET_ID),
    abi: REWARD_VAULT_ABI,
    functionName: "usedRewardId",
    args: [rewardId],
  })) as boolean;
}

/** Unallocated G$ in the vault pool, in whole G$ — what creditReward can still hand out. */
export async function getPoolAvailableWhole(): Promise<number> {
  const available = (await vaultPublicClient().readContract({
    address: getRewardVaultAddress(CELO_MAINNET_ID),
    abi: REWARD_VAULT_ABI,
    functionName: "availableBalance",
    args: [GOODDOLLAR_ADDRESSES.mainnet],
  })) as bigint;
  return Number(formatUnits(available, 18));
}

export type PoolCreditSubmission =
  | { kind: "already_used"; amountWei: string }
  | { kind: "submitted"; txHash: `0x${string}`; amountWei: string };

/**
 * Broadcasts creditReward and returns as soon as the tx hash is known —
 * without waiting for it to mine — so the caller can persist the hash first.
 * A timeout while waiting then leaves a tx we can still look up, instead of
 * an unknown one. Checks usedRewardId and the pool first, so a retry of a
 * reward that already landed never sends a doomed tx.
 */
export async function submitPoolCredit(params: {
  recipientWallet: `0x${string}`;
  amountWhole: number;
  rewardId: `0x${string}`;
  context: string;
}): Promise<PoolCreditSubmission> {
  const account = getRewarderAccount();
  const vault = getRewardVaultAddress(CELO_MAINNET_ID);
  const token = GOODDOLLAR_ADDRESSES.mainnet;
  const amountWei = parseTokenAmount(params.amountWhole, token, 18);
  const publicClient = vaultPublicClient();

  if (await isRewardIdUsed(params.rewardId)) {
    return { kind: "already_used", amountWei: amountWei.toString() };
  }

  const available = (await publicClient.readContract({
    address: vault,
    abi: REWARD_VAULT_ABI,
    functionName: "availableBalance",
    args: [token],
  })) as bigint;
  if (available < amountWei) {
    throw new Error(
      `RewardVault pool is out of G$ (${formatUnits(available, 18)} available) for ${params.context}`,
    );
  }

  const walletClient = createWalletClient({ account, chain: celo, transport: http(getRpcUrl()) });
  const txHash = await walletClient.writeContract({
    address: vault,
    abi: REWARD_VAULT_ABI,
    functionName: "creditReward",
    args: [params.recipientWallet, token, amountWei, params.rewardId],
  });
  return { kind: "submitted", txHash, amountWei: amountWei.toString() };
}

export type CreditTxState = "confirmed" | "reverted" | "pending";

/** Waits up to `timeoutMs` for a creditReward tx; "pending" means it hasn't mined (or can't be found) yet. */
export async function waitForPoolCredit(txHash: `0x${string}`, timeoutMs = 60_000): Promise<CreditTxState> {
  try {
    const receipt = await vaultPublicClient().waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
      timeout: timeoutMs,
    });
    return receipt.status === "success" ? "confirmed" : "reverted";
  } catch {
    return "pending";
  }
}

/** One-shot receipt lookup for reconciling a previously submitted tx. */
export async function checkPoolCredit(txHash: `0x${string}`): Promise<CreditTxState> {
  try {
    const receipt = await vaultPublicClient().getTransactionReceipt({ hash: txHash });
    return receipt.status === "success" ? "confirmed" : "reverted";
  } catch {
    return "pending";
  }
}

const REWARD_DEPOSITED_EVENT = parseAbiItem(
  "event RewardDeposited(address indexed user, address indexed token, uint256 amount, bytes32 indexed rewardId, address depositedBy)",
);

/**
 * Finds the tx that consumed `rewardId` — for the rare case where the vault
 * says it's used but we never saved the hash (a worker died between
 * broadcast and the DB write). Searches back `lookbackBlocks`; null if the
 * RPC refuses the range or nothing is found.
 */
export async function findPoolCreditTx(
  rewardId: `0x${string}`,
  lookbackBlocks = 500_000n,
): Promise<`0x${string}` | null> {
  try {
    const client = vaultPublicClient();
    const latest = await client.getBlockNumber();
    const logs = await client.getLogs({
      address: getRewardVaultAddress(CELO_MAINNET_ID),
      event: REWARD_DEPOSITED_EVENT,
      args: { rewardId },
      fromBlock: latest > lookbackBlocks ? latest - lookbackBlocks : 0n,
      toBlock: latest,
    });
    return logs[0]?.transactionHash ?? null;
  } catch {
    return null;
  }
}

/**
 * Credits `amountWhole` G$ from RewardVault's pre-funded pool as a claimable
 * reward for `recipientWallet`, keyed by `rewardId` for idempotency (checked
 * on-chain before sending, so a retried call can't double-credit). No tokens
 * move at all here — the vault earmarks part of its own unallocated balance,
 * and the user later claims it themselves (existing claim flow).
 */
async function creditFromRewardPool(params: {
  recipientWallet: `0x${string}`;
  amountWhole: number;
  rewardId: `0x${string}`;
  revertContext: string;
}): Promise<VaultDepositResult> {
  const { rewardId } = params;
  const submission = await submitPoolCredit({
    recipientWallet: params.recipientWallet,
    amountWhole: params.amountWhole,
    rewardId,
    context: params.revertContext,
  });
  if (submission.kind === "already_used") {
    return { txHash: null, amountWei: submission.amountWei, rewardId, alreadyUsed: true };
  }
  const state = await waitForPoolCredit(submission.txHash);
  if (state !== "confirmed") {
    throw new Error(
      state === "reverted"
        ? `creditReward reverted for ${params.revertContext}`
        : `creditReward not confirmed in time for ${params.revertContext} (tx ${submission.txHash})`,
    );
  }
  return { txHash: submission.txHash, amountWei: submission.amountWei, rewardId, alreadyUsed: false };
}

/** On-chain rewardId for a Rewards Engine ledger row — derived from its dedupe key, so it's stable across retries. */
export function engineRewardId(dedupeKey: string): `0x${string}` {
  return keccak256(toHex(`rewards-engine:${dedupeKey}`));
}

export async function payoutReferralReward(params: {
  referrerWallet: `0x${string}`;
  referralCreditId: string;
  amountWhole: number;
}): Promise<ReferralPayoutResult> {
  return creditFromRewardPool({
    recipientWallet: params.referrerWallet,
    amountWhole: params.amountWhole,
    rewardId: referralRewardId(params.referralCreditId),
    revertContext: `referral credit ${params.referralCreditId}`,
  });
}

/** Credits the one-time 1000 G$ onboarding gift from the RewardVault pool for `wallet`. */
export async function payoutOnboardingGift(params: {
  wallet: `0x${string}`;
  amountWhole: number;
}): Promise<VaultDepositResult> {
  return creditFromRewardPool({
    recipientWallet: params.wallet,
    amountWhole: params.amountWhole,
    rewardId: onboardingGiftRewardId(params.wallet),
    revertContext: `onboarding gift for ${params.wallet}`,
  });
}

/** Credits a per-proof G$ reward from the RewardVault pool for `wallet`. */
export async function payoutProofReward(params: {
  wallet: `0x${string}`;
  proofTxHash: `0x${string}`;
  amountWhole: number;
}): Promise<VaultDepositResult> {
  return creditFromRewardPool({
    recipientWallet: params.wallet,
    amountWhole: params.amountWhole,
    rewardId: proofRewardRewardId(params.proofTxHash),
    revertContext: `proof reward for ${params.proofTxHash}`,
  });
}

export type RewarderStatus = {
  address: string;
  celoBalance: string;
  vaultAddress: string;
  /** Unallocated G$ in the vault — what automated rewards can still pay out. */
  poolAvailable: string;
  /** G$ already credited to users but not yet claimed. */
  poolOwed: string;
};

/**
 * Diagnostic for the admin dashboard — never exposes the key itself, just
 * enough to tell "pool needs topping up" / "wallet needs gas" apart from
 * "something else is wrong" without needing RPC/log access.
 */
export async function getRewarderStatus(): Promise<RewarderStatus> {
  const account = getRewarderAccount();
  const rpc = getRpcUrl();
  const vault = getRewardVaultAddress(CELO_MAINNET_ID);
  const token = GOODDOLLAR_ADDRESSES.mainnet;
  const publicClient = createPublicClient({ chain: celo, transport: http(rpc) });

  const [celoWei, availableWei, owedWei] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({
      address: vault,
      abi: REWARD_VAULT_ABI,
      functionName: "availableBalance",
      args: [token],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: vault,
      abi: REWARD_VAULT_ABI,
      functionName: "totalPendingByToken",
      args: [token],
    }) as Promise<bigint>,
  ]);

  return {
    address: account.address,
    celoBalance: formatEther(celoWei),
    vaultAddress: vault,
    poolAvailable: formatUnits(availableWei, 18),
    poolOwed: formatUnits(owedWei, 18),
  };
}
