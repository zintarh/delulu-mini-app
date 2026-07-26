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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Client often confirms the tx on a wallet/RPC before the server's Forno node
 * has indexed it. Poll getTransactionReceipt with backoff instead of a single
 * wait that can fail and surface a scary "saving failed" UI.
 */
async function waitForMinedReceipt(txHash: `0x${string}`): Promise<TransactionReceipt> {
  const attempts = 10;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      const existing = await publicClient.getTransactionReceipt({ hash: txHash });
      if (existing) return existing;
    } catch (err) {
      lastError = err;
    }

    try {
      return await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: 12_000,
        pollingInterval: 1_200,
      });
    } catch (err) {
      lastError = err;
    }

    await sleep(800 + i * 600);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Transaction not found on RPC yet — try again in a moment");
}

function forfeitMarketAddress() {
  return getForfeitMarketAddress(DELULU_CHAIN_ID);
}

export async function parseForfeitCommitmentCreatedFromTx(txHash: `0x${string}`): Promise<{
  commitmentId: bigint;
  creator: string;
  token: string;
  stakeAmount: bigint;
  destinationType: number;
  destinationAddr: string;
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
    destinationType?: number;
    destinationAddr?: string;
    firstDeadline?: bigint;
    verifier?: string;
  };
  if (
    args.commitmentId == null ||
    !args.creator ||
    !args.token ||
    args.stakeAmount == null ||
    args.destinationType == null ||
    !args.destinationAddr ||
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
    destinationType: Number(args.destinationType),
    destinationAddr: args.destinationAddr.toLowerCase(),
    firstDeadline: args.firstDeadline,
    verifier: args.verifier.toLowerCase(),
  };
}

export async function parseProofSubmittedFromTx(txHash: `0x${string}`): Promise<{
  commitmentId: bigint;
  periodIndex: number;
  creator: string;
  proofLink: string;
} | null> {
  const receipt = await waitForMinedReceipt(txHash);
  if (receipt.status !== "success") {
    throw new Error("Submit-proof transaction reverted on-chain");
  }
  const contract = forfeitMarketAddress();
  const logs = parseEventLogs({
    abi: FORFEIT_MARKET_ABI,
    eventName: "ProofSubmitted",
    logs: receipt.logs,
  });
  const match = logs.find((log) => log.address.toLowerCase() === contract.toLowerCase());
  if (!match) return null;
  const args = match.args as {
    commitmentId?: bigint;
    periodIndex?: number;
    creator?: string;
    proofLink?: string;
  };
  if (args.commitmentId == null || args.periodIndex == null || !args.creator || args.proofLink == null) {
    return null;
  }
  return {
    commitmentId: args.commitmentId,
    periodIndex: Number(args.periodIndex),
    creator: args.creator.toLowerCase(),
    proofLink: args.proofLink,
  };
}

export async function parsePeriodResolvedSuccessFromTx(txHash: `0x${string}`): Promise<{
  commitmentId: bigint;
  periodIndex: number;
  resolver: string;
  commitmentEnded: boolean;
} | null> {
  const receipt = await waitForMinedReceipt(txHash);
  if (receipt.status !== "success") {
    throw new Error("Resolve transaction reverted on-chain");
  }
  const contract = forfeitMarketAddress();
  const logs = parseEventLogs({
    abi: FORFEIT_MARKET_ABI,
    eventName: "PeriodResolvedSuccess",
    logs: receipt.logs,
  });
  const match = logs.find((log) => log.address.toLowerCase() === contract.toLowerCase());
  if (!match) return null;
  const args = match.args as {
    commitmentId?: bigint;
    periodIndex?: number;
    resolver?: string;
    commitmentEnded?: boolean;
  };
  if (args.commitmentId == null || args.periodIndex == null || !args.resolver || args.commitmentEnded == null) {
    return null;
  }
  return {
    commitmentId: args.commitmentId,
    periodIndex: Number(args.periodIndex),
    resolver: args.resolver.toLowerCase(),
    commitmentEnded: args.commitmentEnded,
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
