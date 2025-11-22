// Contract addresses - Static constants
export const DELULU_CONTRACT_ADDRESS = "0xd35643920B38538a6a1BB6a288076f19dBe1Ae40" as `0x${string}`;
export const CUSD_CONTRACT_ADDRESS = "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b" as `0x${string}`;

// Contract constants from the Delulu contract
export const CONTRACT_CONSTANTS = {
  PLATFORM_FEE_BPS: 10, // 0.1%
  CLIMATE_ALLOCATION_BPS: 2000, // 20% of platform fees
  WITHDRAWAL_PENALTY_BPS: 500, // 5%
  MIN_SWITCH_PENALTY_BPS: 50, // 0.5%
  MAX_SWITCH_PENALTY_BPS: 1000, // 10%
  BPS_DENOMINATOR: 10000,
} as const;

// Enums matching Solidity contract
export enum DelusionStatus {
  Active = 0,
  SuccessFinalized = 1,
  FailedFinalized = 2,
  Cancelled = 3,
}

export enum StakePosition {
  None = 0,
  Believe = 1,
  Doubt = 2,
}

// TypeScript types matching contract structs
export type Delusion = {
  id: bigint;
  creator: `0x${string}`;
  delulu: string;
  createdAt: bigint;
  deadline: bigint;
  believePool: bigint;
  doubtPool: bigint;
  believerCount: bigint;
  doubterCount: bigint;
  status: DelusionStatus;
};

export type UserStake = {
  amount: bigint;
  position: StakePosition;
  stakedAt: bigint;
  hasClaimed: boolean;
};

