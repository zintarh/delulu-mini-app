import { getSubgraphUrlForChain } from "@/lib/constant";
import { CELO_MAINNET_ID } from "@/lib/constant";

export type CommunityCampaignLeaderboardRow = {
  rank: number;
  wallet_address: string;
  points_total: number;
  current_streak: number;
  joined_at: string | null;
  is_community_member: boolean;
};

type SubgraphParticipant = {
  participantAddress: string;
  pointsTotal: string;
  streak: string;
  joinedAt: string;
};

async function fetchSubgraph<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const url =
    getSubgraphUrlForChain(CELO_MAINNET_ID) || process.env.NEXT_PUBLIC_SUBGRAPH_URL;
  if (!url) throw new Error("Subgraph URL not configured");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 15 },
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "Subgraph query failed");
  }
  return json.data as T;
}

const LEADERBOARD_QUERY = `
  query CommunityCampaignLeaderboard($challengeId: BigInt!, $first: Int!) {
    communityCampaignParticipants(
      first: $first
      orderBy: pointsTotal
      orderDirection: desc
      where: { challengeId: $challengeId }
    ) {
      participantAddress
      pointsTotal
      streak
      joinedAt
    }
  }
`;

const JOINED_QUERY = `
  query CommunityCampaignJoined($challengeId: BigInt!, $address: String!) {
    communityCampaignParticipants(
      where: { challengeId: $challengeId, participantAddress: $address }
      first: 1
    ) {
      id
      pointsTotal
    }
  }
`;

const PARTICIPANT_COUNT_QUERY = `
  query CommunityCampaignParticipantCount($challengeId: BigInt!) {
    communityCampaignParticipants(
      where: { challengeId: $challengeId }
      first: 1000
    ) {
      id
    }
  }
`;

const JOINED_CHALLENGE_IDS_QUERY = `
  query JoinedCommunityCampaigns($address: String!, $challengeIds: [BigInt!]!) {
    communityCampaignParticipants(
      where: { participantAddress: $address, challengeId_in: $challengeIds }
      first: 200
    ) {
      challengeId
    }
  }
`;

export async function fetchCommunityCampaignLeaderboardFromGraph(
  challengeId: number,
  memberWallets: Set<string>,
): Promise<CommunityCampaignLeaderboardRow[]> {
  try {
    const data = await fetchSubgraph<{
      communityCampaignParticipants: SubgraphParticipant[];
    }>(LEADERBOARD_QUERY, { challengeId: challengeId.toString(), first: 100 });

    return (data.communityCampaignParticipants ?? []).map((row, index) => {
      const wallet = row.participantAddress.toLowerCase();
      return {
        rank: index + 1,
        wallet_address: wallet,
        points_total: Number(row.pointsTotal),
        current_streak: Number(row.streak),
        joined_at: row.joinedAt
          ? new Date(Number(row.joinedAt) * 1000).toISOString()
          : null,
        is_community_member: memberWallets.has(wallet),
      };
    });
  } catch {
    return [];
  }
}

export async function isJoinedCommunityCampaignOnGraph(
  challengeId: number,
  walletAddress: string,
): Promise<{ joined: boolean; pointsTotal: number }> {
  try {
    const data = await fetchSubgraph<{
      communityCampaignParticipants: Array<{ id: string; pointsTotal: string }>;
    }>(JOINED_QUERY, {
      challengeId: challengeId.toString(),
      address: walletAddress.toLowerCase(),
    });
    const row = data.communityCampaignParticipants?.[0];
    return {
      joined: Boolean(row),
      pointsTotal: row ? Number(row.pointsTotal) : 0,
    };
  } catch {
    return { joined: false, pointsTotal: 0 };
  }
}

export async function fetchCommunityCampaignParticipantCountFromGraph(
  challengeId: number,
): Promise<number> {
  try {
    const data = await fetchSubgraph<{
      communityCampaignParticipants: Array<{ id: string }>;
    }>(PARTICIPANT_COUNT_QUERY, { challengeId: challengeId.toString() });
    return data.communityCampaignParticipants?.length ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchJoinedChallengeIdsFromGraph(
  walletAddress: string,
  challengeIds: number[],
): Promise<Set<number>> {
  if (challengeIds.length === 0) return new Set();
  try {
    const data = await fetchSubgraph<{
      communityCampaignParticipants: Array<{ challengeId: string }>;
    }>(JOINED_CHALLENGE_IDS_QUERY, {
      address: walletAddress.toLowerCase(),
      challengeIds: challengeIds.map(String),
    });
    return new Set(
      (data.communityCampaignParticipants ?? []).map((r) => Number(r.challengeId)),
    );
  } catch {
    return new Set();
  }
}
