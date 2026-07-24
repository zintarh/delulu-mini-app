import { gql } from "@apollo/client";

export const EXPLORE_FEED_PAGE_SIZE = 9;

export const GET_DELULUS_FEED = gql`
  query GetDelulusFeed($first: Int = 9, $skip: Int = 0) {
    delulus(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
      where: { isCancelled: false, milestoneCount_gt: 0 }
    ) {
      id
      onChainId
      token
      creator {
        id
        username
      }
      creatorAddress
      contentHash
      stakingDeadline
      resolutionDeadline
      createdAt
      creatorStake
      totalSupportCollected
      totalSupporters
      challengeId
      isResolved
      isCancelled
      milestoneCount
      milestones(first: 15, orderBy: milestoneId, orderDirection: asc) {
        id
        milestoneId
        milestoneURI
        deadline
        startTime
        isSubmitted
        isVerified
      }
    }
  }
`;
