import { createPublicClient, http, parseEventLogs } from "viem";
import { celo } from "viem/chains";
import { DELULU_ABI_WITH_COMMUNITY } from "@/lib/abi/delulu-with-community";
import { DELULU_CHAIN_ID, getDeluluContractAddress } from "@/lib/constant";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(),
});

function contractAddress() {
  return getDeluluContractAddress(DELULU_CHAIN_ID);
}

export async function parseChallengeIdFromTx(txHash: `0x${string}`): Promise<bigint | null> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  const contract = contractAddress();
  const logs = parseEventLogs({
    abi: DELULU_ABI_WITH_COMMUNITY,
    eventName: "ChallengeCreated",
    logs: receipt.logs,
  });
  const match = logs.find(
    (log) => log.address.toLowerCase() === contract.toLowerCase(),
  );
  if (!match) return null;
  const args = match.args as { challengeId?: bigint };
  return args.challengeId ?? null;
}

export async function parseCommunityChallengeFundedFromTx(
  txHash: `0x${string}`,
): Promise<{ challengeId: bigint; totalPool: bigint } | null> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  const contract = contractAddress();
  const logs = parseEventLogs({
    abi: DELULU_ABI_WITH_COMMUNITY,
    eventName: "CommunityChallengeFunded",
    logs: receipt.logs,
  });
  const match = logs.find(
    (log) => log.address.toLowerCase() === contract.toLowerCase(),
  );
  if (!match) return null;
  const args = match.args as { challengeId?: bigint; totalPool?: bigint };
  if (args.challengeId == null || args.totalPool == null) return null;
  return { challengeId: args.challengeId, totalPool: args.totalPool };
}

export async function parseCommunityChallengeEndedFromTx(
  txHash: `0x${string}`,
): Promise<{ challengeId: bigint; endedAt: bigint } | null> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  const contract = contractAddress();
  const logs = parseEventLogs({
    abi: DELULU_ABI_WITH_COMMUNITY,
    eventName: "CommunityChallengeEnded",
    logs: receipt.logs,
  });
  const match = logs.find(
    (log) => log.address.toLowerCase() === contract.toLowerCase(),
  );
  if (!match) return null;
  const args = match.args as { challengeId?: bigint; endedAt?: bigint };
  if (args.challengeId == null || args.endedAt == null) return null;
  return { challengeId: args.challengeId, endedAt: args.endedAt };
}
