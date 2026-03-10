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
export { useCreatorLeaderboard } from "./useCreatorLeaderboard";

// ─── User Profile Hooks ─────────────────────────────────────────
export { useGraphUserDelulus } from "./useGraphUserDelulus";
export { useGraphStakedDelulus } from "./useGraphStakedDelulus";
export { useGraphUserStats } from "./useGraphUserStats";
export type { UserStats } from "./useGraphUserStats";

// ─── Stakes & Claims ────────────────────────────────────────────
export { useGraphDeluluStakes } from "./useGraphDeluluStakes";
export type { GraphStakeEntry } from "./useGraphDeluluStakes";
export { useGraphUserClaims } from "./useGraphUserClaims";
export type { GraphClaim } from "./useGraphUserClaims";
