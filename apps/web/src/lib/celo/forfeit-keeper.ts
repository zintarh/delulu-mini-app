import { createPublicClient, createWalletClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { FORFEIT_MARKET_ABI } from "@/lib/abi/forfeit-market";
import { DELULU_CHAIN_ID, getForfeitMarketAddress } from "@/lib/constant";

/**
 * The permissionless `resolveCommitmentForfeited` keeper bounty (see
 * ForfeitMarket.sol) is a decentralization backstop, not the primary
 * resolution guarantee — bounties on small stakes aren't reliably attractive
 * to third-party keepers. This wallet is Delulu's own keeper of last resort,
 * run from the deadline-check cron. Reuses the same funded-server-wallet
 * pattern as the CELO gas faucet (send-celo.ts), just against a different
 * contract call instead of a native transfer.
 */
function getKeeperAccount() {
  const raw = process.env.FORFEIT_KEEPER_PRIVATE_KEY || process.env.CELO_FAUCET_PRIVATE_KEY;
  if (!raw) throw new Error("FORFEIT_KEEPER_PRIVATE_KEY is not configured");
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

/**
 * Diagnostic only — the keeper's address and CELO balance, never the key
 * itself. Lets the deadline-check cron report *why* resolves are failing
 * (unfunded wallet vs. something else) without needing Vercel log access.
 */
export async function getKeeperStatus(): Promise<{ address: string; celoBalance: string }> {
  const account = getKeeperAccount();
  const publicClient = createPublicClient({ chain: celo, transport: http(getRpcUrl()) });
  const balance = await publicClient.getBalance({ address: account.address });
  return { address: account.address, celoBalance: formatEther(balance) };
}

/** Resolves one overdue commitment as forfeited. Returns the tx hash once mined. */
export async function resolveCommitmentForfeitedAsKeeper(
  commitmentId: bigint,
): Promise<`0x${string}`> {
  const account = getKeeperAccount();
  const rpc = getRpcUrl();
  const address = getForfeitMarketAddress(DELULU_CHAIN_ID);

  const publicClient = createPublicClient({ chain: celo, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain: celo, transport: http(rpc) });

  const hash = await walletClient.writeContract({
    address,
    abi: FORFEIT_MARKET_ABI,
    functionName: "resolveCommitmentForfeited",
    args: [commitmentId],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
    timeout: 45_000,
  });
  if (receipt.status !== "success") {
    throw new Error(`resolveCommitmentForfeited reverted for commitment ${commitmentId}`);
  }
  return hash;
}
