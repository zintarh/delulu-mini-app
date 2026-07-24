import { createPublicClient, http, parseEventLogs } from "viem";
import { celo } from "viem/chains";
import { DELULU_ABI } from "@/lib/abi";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";
import { DELULU_CHAIN_ID, getDeluluContractAddress, getCommunityMarketV1Address } from "@/lib/constant";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(),
});

/** Personal-goals proxy — used for ChallengeCreated (non-community). */
function proxyAddress() {
  return getDeluluContractAddress(DELULU_CHAIN_ID);
}

/** Community campaign contract — used for all CommunityCampaign* events. */
function cmv1Address() {
  return getCommunityMarketV1Address(DELULU_CHAIN_ID);
}

export async function parseChallengeIdFromTx(txHash: `0x${string}`): Promise<bigint | null> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
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
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
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
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
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
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
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
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
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
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
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
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
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
