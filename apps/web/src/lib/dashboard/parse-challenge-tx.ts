import { createPublicClient, http, parseEventLogs, type TransactionReceipt } from "viem";
import { celo } from "viem/chains";
import { DELULU_ABI } from "@/lib/abi";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";
import { DELULU_CHAIN_ID, getDeluluContractAddress, getCommunityMarketV1Address } from "@/lib/constant";

const CELO_RPC =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  process.env.CELO_RPC_URL ??
  "https://forno.celo.org";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC),
});

/**
 * Wait until the tx is mined (and optionally confirmed). Callers used to hit
 * `getTransactionReceipt` immediately after broadcast, which races Celo RPC
 * indexing and surfaces viem's "receipt could not be found" even when the tx
 * succeeded on-chain a second later.
 */
async function waitForMinedReceipt(txHash: `0x${string}`): Promise<TransactionReceipt> {
  return publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
    timeout: 120_000,
    pollingInterval: 1_500,
  });
}

/** Personal-goals proxy — used for ChallengeCreated (non-community). */
function proxyAddress() {
  return getDeluluContractAddress(DELULU_CHAIN_ID);
}

/** Community campaign contract — used for all CommunityCampaign* events. */
function cmv1Address() {
  return getCommunityMarketV1Address(DELULU_CHAIN_ID);
}

export async function parseChallengeIdFromTx(txHash: `0x${string}`): Promise<bigint | null> {
  const receipt = await waitForMinedReceipt(txHash);
  const contract = proxyAddress();
  const logs = parseEventLogs({
    abi: DELULU_ABI,
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

export async function parseCommunityChallengeCreatedFromTx(
  txHash: `0x${string}`,
): Promise<bigint | null> {
  const receipt = await waitForMinedReceipt(txHash);
  const contract = cmv1Address();
  const logs = parseEventLogs({
    abi: COMMUNITY_CAMPAIGN_ABI,
    eventName: "CommunityChallengeCreated",
    logs: receipt.logs,
  });
  const match = logs.find(
    (log) => log.address.toLowerCase() === contract.toLowerCase(),
  );
  if (!match) return null;
  const args = match.args as { campaignId?: bigint };
  return args.campaignId ?? null;
}

export async function parseCommunityChallengeFundedFromTx(
  txHash: `0x${string}`,
): Promise<{ challengeId: bigint; totalPool: bigint } | null> {
  const receipt = await waitForMinedReceipt(txHash);
  const contract = cmv1Address();
  const logs = parseEventLogs({
    abi: COMMUNITY_CAMPAIGN_ABI,
    eventName: "CommunityChallengeFunded",
    logs: receipt.logs,
  });
  const match = logs.find(
    (log) => log.address.toLowerCase() === contract.toLowerCase(),
  );
  if (!match) return null;
  const args = match.args as { campaignId?: bigint; totalPool?: bigint };
  if (args.campaignId == null || args.totalPool == null) return null;
  return { challengeId: args.campaignId, totalPool: args.totalPool };
}

export async function parseCommunityChallengeEndedFromTx(
  txHash: `0x${string}`,
): Promise<{ challengeId: bigint; endedAt: bigint } | null> {
  const receipt = await waitForMinedReceipt(txHash);
  if (receipt.status !== "success") {
    throw new Error("End transaction reverted on-chain");
  }
  const contract = cmv1Address();
  const logs = parseEventLogs({
    abi: COMMUNITY_CAMPAIGN_ABI,
    eventName: "CommunityChallengeEnded",
    logs: receipt.logs,
  });
  const match = logs.find(
    (log) => log.address.toLowerCase() === contract.toLowerCase(),
  );
  if (!match) return null;
  const args = match.args as { campaignId?: bigint; endedAt?: bigint };
  if (args.campaignId == null || args.endedAt == null) return null;
  return { challengeId: args.campaignId, endedAt: args.endedAt };
}

export async function parseCommunityCampaignMilestonesAddedFromTx(
  txHash: `0x${string}`,
): Promise<{ challengeId: bigint; milestoneCount: bigint } | null> {
  const receipt = await waitForMinedReceipt(txHash);
  const contract = cmv1Address();
  const logs = parseEventLogs({
    abi: COMMUNITY_CAMPAIGN_ABI,
    eventName: "CommunityCampaignMilestonesAdded",
    logs: receipt.logs,
  });
  const match = logs.find(
    (log) => log.address.toLowerCase() === contract.toLowerCase(),
  );
  if (!match) return null;
  const args = match.args as { campaignId?: bigint; milestoneCount?: bigint };
  if (args.campaignId == null || args.milestoneCount == null) return null;
  return { challengeId: args.campaignId, milestoneCount: args.milestoneCount };
}

export async function parseCommunityPayoutRootSetFromTx(
  txHash: `0x${string}`,
): Promise<{ challengeId: bigint; merkleRoot: `0x${string}`; totalClaimable: bigint } | null> {
  const receipt = await waitForMinedReceipt(txHash);
  const contract = cmv1Address();
  const logs = parseEventLogs({
    abi: COMMUNITY_CAMPAIGN_ABI,
    eventName: "CommunityPayoutRootSet",
    logs: receipt.logs,
  });
  const match = logs.find(
    (log) => log.address.toLowerCase() === contract.toLowerCase(),
  );
  if (!match) return null;
  const args = match.args as {
    campaignId?: bigint;
    merkleRoot?: `0x${string}`;
    totalClaimable?: bigint;
  };
  if (args.campaignId == null || !args.merkleRoot || args.totalClaimable == null) return null;
  return { challengeId: args.campaignId, merkleRoot: args.merkleRoot, totalClaimable: args.totalClaimable };
}

export async function parseCommunityCampaignJoinedFromTx(
  txHash: `0x${string}`,
): Promise<{ challengeId: bigint; participant: string } | null> {
  const receipt = await waitForMinedReceipt(txHash);
  const contract = cmv1Address();
  const logs = parseEventLogs({
    abi: COMMUNITY_CAMPAIGN_ABI,
    eventName: "CommunityCampaignJoined",
    logs: receipt.logs,
  });
  const match = logs.find(
    (log) => log.address.toLowerCase() === contract.toLowerCase(),
  );
  if (!match) return null;
  const args = match.args as { campaignId?: bigint; participant?: string };
  if (args.campaignId == null || !args.participant) return null;
  return { challengeId: args.campaignId, participant: args.participant.toLowerCase() };
}
