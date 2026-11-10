/**
 * Graph Hooks — Clean abstraction layer over The Graph subgraph.
 *
 * These hooks replace the old Prisma-backed API fetchers with direct
 * subgraph queries via Apollo Client + generated typed document nodes.
 *
 * Import from "@/hooks/graph" for the complete API.
 */

// ─── Feed & Market Hooks ────────────────────────────────────────
export { useAllDelulus } from "./useAllDelulus";
export { useGraphDelulu } from "./useGraphDelulu";
export type { GraphStake } from "./useGraphDelulu";

// ─── Leaderboards ───────────────────────────────────────────────
export { useDeluluLeaderboard } from "./useDeluluLeaderboard";
export type { DeluluLeaderboardEntry } from "./useDeluluLeaderboard";
export { useAllUsersLeaderboard } from "./useAllUsersLeaderboard";
export type { UserLeaderboardEntry } from "./useAllUsersLeaderboard";

// ─── Stakes & Claims ────────────────────────────────────────────
export { useGraphDeluluStakes } from "./useGraphDeluluStakes";
export type { GraphStakeEntry } from "./useGraphDeluluStakes";
export { useGraphUserClaims } from "./useGraphUserClaims";
export type { GraphClaim } from "./useGraphUserClaims";
