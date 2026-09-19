import { createPublicClient, createWalletClient, formatEther, formatUnits, http, keccak256, maxUint256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { REWARD_VAULT_ABI } from "@/lib/abi/reward-vault";
import { GOODDOLLAR_ADDRESSES, getRewardVaultAddress, CELO_MAINNET_ID } from "@/lib/constant";
import { parseTokenAmount } from "@/lib/token-amounts";

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ERC20_ALLOWANCE_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Same funded-server-wallet as the CELO gas faucet and forfeit-keeper
 * (send-celo.ts, forfeit-keeper.ts) — already the RewardVault owner/rewarder
 * on Celo mainnet, so no separate rewarder grant is needed.
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

export type VaultDepositResult = {
  txHash: `0x${string}` | null;
  amountWei: string;
  rewardId: `0x${string}`;
  alreadyUsed: boolean;
};

export type ReferralPayoutResult = VaultDepositResult;

/**
 * Deposits `amountWhole` G$ into RewardVault as a claimable reward for
 * `recipientWallet`, keyed by `rewardId` for idempotency (checked on-chain
 * before sending, so a retried call can't double-credit). The reward stays
 * in the vault until the user claims it themselves (existing claim flow) —
 * this only moves funds from the rewarder wallet into the vault, never
 * directly to the user.
 */
async function depositToRewardVault(params: {
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

  const walletClient = createWalletClient({ account, chain: celo, transport: http(rpc) });

  const allowance = (await publicClient.readContract({
    address: token,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: "allowance",
    args: [account.address, vault],
  })) as bigint;

  if (allowance < amountWei) {
    // Approve once, generously — this wallet also sends CELO/keeper txs from
    // the same key, so avoiding a per-payout approval halves the nonce churn.
    const approveHash = await walletClient.writeContract({
      address: token,
      abi: ERC20_ALLOWANCE_ABI,
      functionName: "approve",
      args: [vault, maxUint256],
    });
    const approveReceipt = await publicClient.waitForTransactionReceipt({
      hash: approveHash,
      confirmations: 1,
      timeout: 45_000,
    });
    if (approveReceipt.status !== "success") {
      throw new Error("G$ allowance approval for RewardVault reverted");
    }
  }

  const hash = await walletClient.writeContract({
    address: vault,
    abi: REWARD_VAULT_ABI,
    functionName: "depositReward",
    args: [params.recipientWallet, token, amountWei, rewardId],
  });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
    timeout: 60_000,
  });
  if (receipt.status !== "success") {
    throw new Error(`depositReward reverted for ${params.revertContext}`);
  }
  return { txHash: hash, amountWei: amountWei.toString(), rewardId, alreadyUsed: false };
}

export async function payoutReferralReward(params: {
  referrerWallet: `0x${string}`;
  referralCreditId: string;
  amountWhole: number;
}): Promise<ReferralPayoutResult> {
  return depositToRewardVault({
    recipientWallet: params.referrerWallet,
    amountWhole: params.amountWhole,
    rewardId: referralRewardId(params.referralCreditId),
    revertContext: `referral credit ${params.referralCreditId}`,
  });
}

/** Deposits the one-time 1000 G$ onboarding gift into RewardVault for `wallet`. */
export async function payoutOnboardingGift(params: {
  wallet: `0x${string}`;
  amountWhole: number;
}): Promise<VaultDepositResult> {
  return depositToRewardVault({
    recipientWallet: params.wallet,
    amountWhole: params.amountWhole,
    rewardId: onboardingGiftRewardId(params.wallet),
    revertContext: `onboarding gift for ${params.wallet}`,
  });
}

export type RewarderStatus = {
  address: string;
  celoBalance: string;
  gdollarsBalance: string;
  gdollarsAllowance: string;
};

/**
 * Diagnostic for the admin dashboard — never exposes the key itself, just
 * enough to tell "wallet needs topping up" apart from "something else is
 * wrong" without needing RPC/log access.
 */
export async function getRewarderStatus(): Promise<RewarderStatus> {
  const account = getRewarderAccount();
  const rpc = getRpcUrl();
  const vault = getRewardVaultAddress(CELO_MAINNET_ID);
  const token = GOODDOLLAR_ADDRESSES.mainnet;
  const publicClient = createPublicClient({ chain: celo, transport: http(rpc) });

  const [celoWei, gdollarsWei, allowanceWei] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({
      address: token,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [account.address],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: token,
      abi: ERC20_ALLOWANCE_ABI,
      functionName: "allowance",
      args: [account.address, vault],
    }) as Promise<bigint>,
  ]);

  return {
    address: account.address,
    celoBalance: formatEther(celoWei),
    gdollarsBalance: formatUnits(gdollarsWei, 18),
    gdollarsAllowance: formatUnits(allowanceWei, 18),
  };
}
