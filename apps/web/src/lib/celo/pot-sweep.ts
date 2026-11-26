import { createPublicClient, createWalletClient, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { FORFEIT_MARKET_ABI } from "@/lib/abi/forfeit-market";
import { REWARD_VAULT_ABI } from "@/lib/abi/reward-vault";
import { CELO_MAINNET_ID, GOODDOLLAR_ADDRESSES, getForfeitMarketAddress, getRewardVaultAddress } from "@/lib/constant";

/** Below this, a withdrawal isn't worth the gas: it waits for more missed stakes. */
const MIN_COLLECT_G = 1_000;

const rpc = () => process.env.NEXT_PUBLIC_CELO_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://forno.celo.org";
const isAddress = (a: string | null | undefined): a is `0x${string}` => !!a && /^0x[0-9a-fA-F]{40}$/.test(a) && !/^0x0+$/.test(a);

/**
 * Players' missed stakes are Delulu's revenue (26 Nov 2026). The whole
 * ForfeitMarket community pool ("the Delulu pool") goes to the Delulu
 * treasury via withdrawCommunityPool (owner only). It is no longer swept to
 * the RewardVault, so none of it is paid back out as rewards. Rewards are
 * funded from outside (team / sponsor deposits into the vault).
 *
 * Treasury: DELULU_TREASURY_ADDRESS, else the RewardVault's `treasury`.
 * Signs with the ForfeitMarket owner key (FORFEIT_OWNER_PRIVATE_KEY, else
 * CELO_FAUCET_PRIVATE_KEY, which is the owner today).
 */
export async function collectCommunityPoolRevenue(): Promise<{ collected: number; to: string | null; txHash: `0x${string}` | null; skipped?: string }> {
  const market = getForfeitMarketAddress(CELO_MAINNET_ID);
  const token = GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`;
  const pub = createPublicClient({ chain: celo, transport: http(rpc()) });

  const pool = (await pub.readContract({ address: market, abi: FORFEIT_MARKET_ABI, functionName: "communityPoolBalance", args: [token] })) as bigint;
  const poolG = Number(formatUnits(pool, 18));
  if (poolG < MIN_COLLECT_G) return { collected: 0, to: null, txHash: null, skipped: `pool only ${Math.round(poolG)} G$` };

  let to: string | null = process.env.DELULU_TREASURY_ADDRESS?.trim() || null;
  if (!isAddress(to)) {
    to = (await pub
      .readContract({ address: getRewardVaultAddress(CELO_MAINNET_ID), abi: REWARD_VAULT_ABI, functionName: "treasury" })
      .catch(() => null)) as string | null;
  }
  if (!isAddress(to)) return { collected: 0, to: null, txHash: null, skipped: "no Delulu treasury address" };

  const raw = process.env.FORFEIT_OWNER_PRIVATE_KEY || process.env.CELO_FAUCET_PRIVATE_KEY;
  if (!raw) throw new Error("FORFEIT_OWNER_PRIVATE_KEY is not configured");
  const account = privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`);
  const owner = (await pub.readContract({ address: market, abi: FORFEIT_MARKET_ABI, functionName: "owner" })) as string;
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    return { collected: 0, to, txHash: null, skipped: "signing key is not the ForfeitMarket owner" };
  }

  const wallet = createWalletClient({ account, chain: celo, transport: http(rpc()) });
  const txHash = await wallet.writeContract({ address: market, abi: FORFEIT_MARKET_ABI, functionName: "withdrawCommunityPool", args: [token, to, pool] });
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash, timeout: 90_000 });
  if (receipt.status !== "success") throw new Error(`Community pool withdrawal reverted (${txHash})`);
  return { collected: poolG, to, txHash };
}
