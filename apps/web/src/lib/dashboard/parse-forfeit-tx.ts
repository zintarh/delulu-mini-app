import { createPublicClient, http, parseEventLogs, type TransactionReceipt } from "viem";
import { celo } from "viem/chains";
import { FORFEIT_MARKET_ABI } from "@/lib/abi/forfeit-market";
import { DELULU_CHAIN_ID, getForfeitMarketAddress } from "@/lib/constant";

const CELO_RPC =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  process.env.CELO_RPC_URL ??
  "https://forno.celo.org";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC),
});

async function waitForMinedReceipt(txHash: `0x${string}`): Promise<TransactionReceipt> {
  return publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
    timeout: 120_000,
    pollingInterval: 1_500,
  });
}

function forfeitMarketAddress() {
  return getForfeitMarketAddress(DELULU_CHAIN_ID);
}

export async function parseForfeitCommitmentCreatedFromTx(txHash: `0x${string}`): Promise<{
  commitmentId: bigint;
  creator: string;
  token: string;
  stakeAmount: bigint;
  firstDeadline: bigint;
  verifier: string;
} | null> {
  const receipt = await waitForMinedReceipt(txHash);
  if (receipt.status !== "success") {
    throw new Error("Create transaction reverted on-chain");
  }
  const contract = forfeitMarketAddress();
  const logs = parseEventLogs({
    abi: FORFEIT_MARKET_ABI,
    eventName: "CommitmentCreated",
    logs: receipt.logs,
  });
  const match = logs.find((log) => log.address.toLowerCase() === contract.toLowerCase());
  if (!match) return null;
  const args = match.args as {
    commitmentId?: bigint;
    creator?: string;
    token?: string;
    stakeAmount?: bigint;
    firstDeadline?: bigint;
    verifier?: string;
  };
  if (
    args.commitmentId == null ||
    !args.creator ||
    !args.token ||
    args.stakeAmount == null ||
    args.firstDeadline == null ||
    !args.verifier
  ) {
    return null;
  }
  return {
    commitmentId: args.commitmentId,
    creator: args.creator.toLowerCase(),
    token: args.token.toLowerCase(),
    stakeAmount: args.stakeAmount,
    firstDeadline: args.firstDeadline,
    verifier: args.verifier.toLowerCase(),
  };
}

export async function parseVerifierInviteAcceptedFromTx(
  txHash: `0x${string}`,
): Promise<{ commitmentId: bigint; verifier: string } | null> {
  const receipt = await waitForMinedReceipt(txHash);
  if (receipt.status !== "success") {
    throw new Error("Accept transaction reverted on-chain");
  }
  const contract = forfeitMarketAddress();
  const logs = parseEventLogs({
    abi: FORFEIT_MARKET_ABI,
    eventName: "VerifierInviteAccepted",
    logs: receipt.logs,
  });
  const match = logs.find((log) => log.address.toLowerCase() === contract.toLowerCase());
  if (!match) return null;
  const args = match.args as { commitmentId?: bigint; verifier?: string };
  if (args.commitmentId == null || !args.verifier) return null;
  return { commitmentId: args.commitmentId, verifier: args.verifier.toLowerCase() };
}
