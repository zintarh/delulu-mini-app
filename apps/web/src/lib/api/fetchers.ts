/**
 * Centralized API Fetchers for TanStack Query
 * These functions are designed to be used as queryFn in useQuery hooks
 */

import {
  api,
  type ApiDelulu,
  type ApiUser,
  type ApiStake,
  type ApiClaim,
  type ApiStats,
  type PlatformStats,
  type LeaderboardEntry,
  type ActivityItem,
  type UserPosition,
  type DeluluState,
  type LeaderboardType,
} from "@/lib/api-client";

// Re-export types for convenience
export type {
  ApiDelulu,
  ApiUser,
  ApiStake,
  ApiClaim,
  ApiStats,
  PlatformStats,
  LeaderboardEntry,
  ActivityItem,
  UserPosition,
  DeluluState,
  LeaderboardType,
};

// ============ Query Keys ============
// Centralized query keys for cache management

export const queryKeys = {
  // Delulus
  delulus: {
    all: ["delulus"] as const,
    list: (options?: { limit?: number; creator?: string; includeResolved?: boolean }) =>
      ["delulus", "list", options] as const,
    detail: (id: string) => ["delulus", "detail", id] as const,
    trending: (limit?: number) => ["delulus", "trending", limit] as const,
    byState: (state: DeluluState, options?: { limit?: number; cursor?: string }) =>
      ["delulus", "state", state, options] as const,
  },
  // Users
  users: {
    all: ["users"] as const,
    detail: (address: string) => ["users", address] as const,
    stats: (address: string) => ["users", "stats", address] as const,
    stakedDelulus: (address: string) => ["users", "staked-delulus", address] as const,
    stakes: (address: string) => ["users", "stakes", address] as const,
    claims: (address: string) => ["users", "claims", address] as const,
    position: (address: string, deluluId: string) =>
      ["users", "position", address, deluluId] as const,
  },
  // Leaderboard
  leaderboard: (type: LeaderboardType, limit?: number) =>
    ["leaderboard", type, limit] as const,
  // Activity
  activity: (options?: { address?: string; limit?: number }) =>
    ["activity", options] as const,
  // Platform Stats
  platform: ["platform", "stats"] as const,
} as const;

// ============ Delulu Fetchers ============

export async function fetchDelulus(options?: {
  limit?: number;
  cursor?: string;
  creator?: string;
  includeResolved?: boolean;
}) {
  return api.getDelulus(options);
}

export async function fetchDelulu(id: string) {
  return api.getDelulu(id);
}

export async function fetchTrendingDelulus(limit = 10) {
  return api.getTrendingDelulus(limit);
}

export async function fetchDelulusByState(
  state: DeluluState,
  options?: { limit?: number; cursor?: string }
) {
  return api.getDelulusByState(state, options);
}

// ============ User Fetchers ============

export async function fetchUser(address: string) {
  return api.getUser(address);
}

export async function fetchUserStats(address: string) {
  return api.getUserStats(address);
}

export async function fetchUserStakedDelulus(address: string) {
  return api.getUserStakedDelulus(address);
}

export async function fetchUserStakes(address: string) {
  return api.getUserStakes(address);
}

export async function fetchUserClaims(address: string) {
  return api.getUserClaims(address);
}

export async function fetchUserPosition(address: string, deluluId: string) {
  return api.getUserPosition(address, deluluId);
}

// ============ Leaderboard Fetchers ============

export async function fetchLeaderboard(type: LeaderboardType = "stakers", limit = 10) {
  return api.getLeaderboard(type, limit);
}

// ============ Activity Fetchers ============

export async function fetchActivity(options?: { address?: string; limit?: number }) {
  return api.getActivity(options);
}

// ============ Platform Stats Fetchers ============

export async function fetchPlatformStats() {
  return api.getPlatformStats();
}
