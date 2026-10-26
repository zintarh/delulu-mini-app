import { createPublicClient, createWalletClient, formatEther, formatUnits, http, keccak256, toHex } from "viem";
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
  const account = getRewarderAccount();
  const rpc = getRpcUrl();
  const vault = getRewardVaultAddress(CELO_MAINNET_ID);
  const token = GOODDOLLAR_ADDRESSES.mainnet;
  const amountWei = parseTokenAmount(params.amountWhole, token, 18);
  const { rewardId } = params;

  const publicClient = createPublicClient({ chain: celo, transport: http(rpc) });

  // A prior attempt may have gotten the tx mined but crashed before the DB
  // update landed — check first so a retry never reverts with RewardIdAlreadyUsed.
  const alreadyUsed = (await publicClient.readContract({
    address: vault,
    abi: REWARD_VAULT_ABI,
    functionName: "usedRewardId",
    args: [rewardId],
  })) as boolean;
  if (alreadyUsed) {
    return { txHash: null, amountWei: amountWei.toString(), rewardId, alreadyUsed: true };
  }

  const available = (await publicClient.readContract({
    address: vault,
    abi: REWARD_VAULT_ABI,
    functionName: "availableBalance",
    args: [token],
  })) as bigint;
  if (available < amountWei) {
    throw new Error(
      `RewardVault pool is out of G$ (${formatUnits(available, 18)} available) for ${params.revertContext}`,
    );
  }

  const walletClient = createWalletClient({ account, chain: celo, transport: http(rpc) });
  const hash = await walletClient.writeContract({
    address: vault,
    abi: REWARD_VAULT_ABI,
    functionName: "creditReward",
    args: [params.recipientWallet, token, amountWei, rewardId],
  });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
    timeout: 60_000,
  });
  if (receipt.status !== "success") {
    throw new Error(`creditReward reverted for ${params.revertContext}`);
  }
  return { txHash: hash, amountWei: amountWei.toString(), rewardId, alreadyUsed: false };
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
