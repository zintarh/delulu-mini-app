"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

const USER_POINTS_QUERY = gql`
  query UserPoints($address: String!) {
    user(id: $address) {
      id
      deluluPoints
    }
  }
`;

// Every campaign this wallet has ever participated in, regardless of which
// contract (Delulu-v3 admin-led challenges or CommunityMarketV1) the
// individual campaign runs on — the subgraph indexes both into the same
// communityCampaignParticipants entity.
const USER_CAMPAIGN_POINTS_QUERY = gql`
  query UserCampaignPoints($address: String!) {
    communityCampaignParticipants(where: { participantAddress: $address }, first: 1000) {
      id
      pointsTotal
    }
  }
`;

/**
 * Total points across every source: individual Delulu milestone points
 * (Delulu-v3's deluluPoints) summed with points earned across every
 * community campaign the wallet has joined.
 */
export function useUserTotalPoints(address: string | undefined) {
  const { data: userData, loading: userLoading } = useQuery<{
    user: { deluluPoints: string } | null;
  }>(USER_POINTS_QUERY, {
    variables: { address: address?.toLowerCase() ?? "" },
    skip: !address,
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const { data: campaignData, loading: campaignLoading } = useQuery<{
    communityCampaignParticipants: Array<{ id: string; pointsTotal: string }>;
  }>(USER_CAMPAIGN_POINTS_QUERY, {
    variables: { address: address?.toLowerCase() ?? "" },
    skip: !address,
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const individualPoints = Number(userData?.user?.deluluPoints ?? "0");
  const campaignPoints = (campaignData?.communityCampaignParticipants ?? []).reduce(
    (sum, row) => sum + Number(row.pointsTotal ?? "0"),
    0,
  );

  return {
    points: individualPoints + campaignPoints,
    individualPoints,
    campaignPoints,
    isLoading: (userLoading && !userData) || (campaignLoading && !campaignData),
  };
}
