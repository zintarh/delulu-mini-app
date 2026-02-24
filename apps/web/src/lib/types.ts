/**
 * Shared types for the application
 */

/**
 * Stake side type - represents whether a user is staking as a believer or doubter
 */
export type StakeSide = "believe" | "doubt";

/**
 * Gatekeeper configuration for country-restricted delulus
 */
export interface GatekeeperConfig {
  enabled: boolean;
  type: "country";
  value: string;
  label: string;
}

/**
 * Formatted delulu — the canonical shape consumed by all UI components.
 * Previously lived in hooks/use-delulus.ts; moved here so hooks can be deleted.
 */
export interface FormattedDelulu {
  id: number;
  onChainId?: string;
  creator: string;
  /** ERC20 token address backing this market (multi-token support) */
  tokenAddress: string;
  contentHash: string;
  content?: string;
  username?: string;
  pfpUrl?: string;
  createdAt?: Date;
  gatekeeper?: GatekeeperConfig;
  bgImageUrl?: string;
  stakingDeadline: Date;
  resolutionDeadline: Date;
  totalBelieverStake: number;
  totalDoubterStake: number;
  totalStake: number;
  outcome: boolean;
  isResolved: boolean;
  isCancelled: boolean;
}
