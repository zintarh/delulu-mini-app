// Contract addresses - Static constants
export const DELULU_CONTRACT_ADDRESS = "0xd35643920B38538a6a1BB6a288076f19dBe1Ae40" as `0x${string}`;
export const CUSD_CONTRACT_ADDRESS = "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b" as `0x${string}`;

// Enums matching new DeluluOracle contract
export enum DelusionStatus {
  ACTIVE = 0,
  VERIFIED = 1,
}

export enum StakePosition {
  NONE = 0,
  BELIEVE = 1,
  DOUBT = 2,
}

// TypeScript types matching contract structs
export type Delusion = {
  id: bigint;
  creator: `0x${string}`;
  description: string;
  deadline: bigint;
  believePool: bigint;
  doubtPool: bigint;
  status: DelusionStatus;
  result: boolean;
};

export type UserStake = {
  position: StakePosition;
  amount: bigint;
  claimed: boolean;
};

