// API Response Types

export type ApiResponse<T> = {
  data?: T;
  error?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  nextCursor: string | null;
};

export type UserResponse = {
  id: string;
  address: string;
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type DeluluResponse = {
  id: string;
  onChainId: string;
  contentHash: string;
  content?: string;
  creatorAddress: string;
  stakingDeadline: string;
  resolutionDeadline: string;
  isResolved: boolean;
  isCancelled: boolean;
  outcome?: boolean;
  gatekeeperEnabled: boolean;
  gatekeeperType?: string;
  gatekeeperValue?: string;
  gatekeeperLabel?: string;
  totalBelieverStake: number;
  totalDoubterStake: number;
  createdAt: string;
  updatedAt: string;
  creator?: {
    username?: string;
    pfpUrl?: string;
  };
};

export type StakeResponse = {
  id: string;
  userId: string;
  deluluId: string;
  amount: number;
  side: boolean;
  txHash: string;
  createdAt: string;
};

export type PositionResponse = {
  believerStake: number;
  doubterStake: number;
};

export type StatsResponse = {
  totalStaked: number;
  totalClaimed: number;
  activeStakes: number;
  totalDelulus: number;
  totalBets: number;
};
