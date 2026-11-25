import { createPublicClient, createWalletClient, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { FORFEIT_MARKET_ABI } from "@/lib/abi/forfeit-market";
import { CELO_MAINNET_ID, GOODDOLLAR_ADDRESSES, getForfeitMarketAddress } from "@/lib/constant";
import { vaultV3Live } from "@/lib/celo/reward-vault-payout";

/** Below this, a sweep isn't worth the gas — it waits for more missed stakes. */
const MIN_SWEEP_G = 1_000;

const rpc = () => process.env.NEXT_PUBLIC_CELO_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://forno.celo.org";

/**
 * Players' missed stakes → the reward pot. Sends ForfeitMarket's whole community
 * pool to the RewardVault (sweepCommunityPoolToVault, v3), where 80% funds the
 * rewards of players who kept their goals and 20% goes to Delulu — all on-chain,
 * labelled as player money. Anyone may call the sweep; we use the keeper wallet.
 * A no-op before the v3 upgrade.
 */
export async function sweepCommunityPoolToVault(): Promise<{ swept: number; txHash: `0x${string}` | null; skipped?: string }> {
  if (!(await vaultV3Live())) return { swept: 0, txHash: null, skipped: "vault not on v3 yet" };
  const market = getForfeitMarketAddress(CELO_MAINNET_ID);
  const token = GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`;
  const pub = createPublicClient({ chain: celo, transport: http(rpc()) });

  const vault = (await pub.readContract({ address: market, abi: FORFEIT_MARKET_ABI, functionName: "rewardVault" }).catch(() => null)) as string | null;
  if (!vault || /^0x0+$/.test(vault)) return { swept: 0, txHash: null, skipped: "ForfeitMarket has no reward vault set" };

  const pool = (await pub.readContract({ address: market, abi: FORFEIT_MARKET_ABI, functionName: "communityPoolBalance", args: [token] })) as bigint;
  const poolG = Number(formatUnits(pool, 18));
  if (poolG < MIN_SWEEP_G) return { swept: 0, txHash: null, skipped: `pool only ${Math.round(poolG)} G$` };

  const raw = process.env.CELO_FAUCET_PRIVATE_KEY;
  if (!raw) throw new Error("CELO_FAUCET_PRIVATE_KEY is not configured");
  const account = privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`);
  const wallet = createWalletClient({ account, chain: celo, transport: http(rpc()) });
  const txHash = await wallet.writeContract({ address: market, abi: FORFEIT_MARKET_ABI, functionName: "sweepCommunityPoolToVault", args: [token, pool] });
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash, timeout: 90_000 });
  if (receipt.status !== "success") throw new Error(`Community pool sweep reverted (${txHash})`);
  return { swept: poolG, txHash };
}
