import { createPublicClient, createWalletClient, http, keccak256, maxUint256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { REWARD_VAULT_ABI } from "@/lib/abi/reward-vault";
import { GOODDOLLAR_ADDRESSES, getRewardVaultAddress, CELO_MAINNET_ID } from "@/lib/constant";
import { parseTokenAmount } from "@/lib/token-amounts";

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

export type ReferralPayoutResult = {
  txHash: `0x${string}` | null;
  amountWei: string;
  rewardId: `0x${string}`;
  alreadyUsed: boolean;
};

/**
 * Deposits `amountWhole` G$ into RewardVault as a claimable reward for
 * `referrerWallet`. The reward stays in the vault until the user claims it
 * themselves (existing /rewards claim flow) — this call only moves funds
 * from the rewarder wallet into the vault, never directly to the user.
 */
export async function payoutReferralReward(params: {
  referrerWallet: `0x${string}`;
  referralCreditId: string;
  amountWhole: number;
}): Promise<ReferralPayoutResult> {
  const account = getRewarderAccount();
  const rpc = getRpcUrl();
  const vault = getRewardVaultAddress(CELO_MAINNET_ID);
  const token = GOODDOLLAR_ADDRESSES.mainnet;
  const amountWei = parseTokenAmount(params.amountWhole, token, 18);
  const rewardId = referralRewardId(params.referralCreditId);

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
    args: [params.referrerWallet, token, amountWei, rewardId],
  });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
    timeout: 60_000,
  });
  if (receipt.status !== "success") {
    throw new Error(`depositReward reverted for referral credit ${params.referralCreditId}`);
  }
  return { txHash: hash, amountWei: amountWei.toString(), rewardId, alreadyUsed: false };
}
