// Contract addresses for different networks
import { celo, celoAlfajores } from "wagmi/chains";

export const CONTRACTS = {
  // Delulu Contract
  delulu: {
    [celoAlfajores.id]: "0xd35643920B38538a6a1BB6a288076f19dBe1Ae40" as `0x${string}`, // Deployed on Alfajores
    [celo.id]: "0x0000000000000000000000000000000000000000" as `0x${string}`, // TODO: Add mainnet address
  },
  // cUSD Token Contract (Celo native stable coin)
  cUSD: {
    [celoAlfajores.id]: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1" as `0x${string}`, // Official Alfajores cUSD
    [celo.id]: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as `0x${string}`, // Official Mainnet cUSD
  },
} as const;

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

