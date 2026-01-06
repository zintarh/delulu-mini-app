/**
 * Typed API Client for Backend Integration
 */

// ============ Types ============

export interface ApiUser {
  id: string;
  address: string;
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiDelulu {
  id: string;
  onChainId: string;
  contentHash: string;
  content?: string;
  creatorId: string;
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
  bgImageUrl?: string;
  totalBelieverStake: number;
  totalDoubterStake: number;
  totalStake: number; // TVL - sum of believer + doubter stakes
  createdAt: string;
  updatedAt: string;
  creator?: {
    username?: string;
    pfpUrl?: string;
    address?: string;
  };
  trendingScore?: number;
  userPosition?: {
    believerStake: number;
    doubterStake: number;
  };
}

export interface ApiStake {
  id: string;
  userId: string;
  deluluId: string;
  amount: number;
  side: boolean;
  txHash: string;
  createdAt: string;
  user?: {
    address: string;
    username?: string;
  };
}

export interface ApiClaim {
  id: string;
  userId: string;
  deluluId: string;
  amount: number;
  txHash: string;
  createdAt: string;
}

export interface ApiStats {
  totalStaked: number;
  totalClaimed: number;
  activeStakes: number;
  totalDelulus: number;
  totalBets: number;
}

export interface PlatformStats {
  tvl: number; // Total Value Locked across all markets
  totalBelieverStake: number;
  totalDoubterStake: number;
  totalDelulus: number;
  totalStakes: number;
  totalStakeVolume: number;
  totalUsers: number;
}

export interface LeaderboardEntry {
  address: string;
  username: string | null;
  pfpUrl: string | null;
  value: number;
}

export interface ActivityItem {
  id: string;
  type: "stake" | "claim" | "create";
  userAddress: string;
  username: string | null;
  pfpUrl: string | null;
  deluluId: string;
  deluluContent: string | null;
  amount: number | null;
  side: boolean | null;
  createdAt: string;
}

export interface UserPosition {
  believerStake: number;
  doubterStake: number;
}

export type DeluluState = "open" | "locked" | "resolved" | "cancelled";
export type LeaderboardType = "stakers" | "earners" | "active" | "creators";

// ============ API Response Types ============

interface ApiResponse<T> {
  data?: T;
  error?: string;
  details?: Array<{ field: string; message: string }>;
}

interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
}

// ============ API Client ============

class ApiClient {
  private baseUrl = "/api";

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || `Request failed: ${res.status}`);
    }

    return json;
  }

  // ============ Users ============

  async getUser(address: string): Promise<ApiUser | null> {
    try {
      return await this.request<ApiUser>(`/users?address=${address}`);
    } catch {
      return null;
    }
  }

  async createUser(data: {
    address: string;
    fid?: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  }): Promise<ApiUser> {
    return this.request<ApiUser>("/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getUserStakedDelulus(address: string): Promise<ApiDelulu[]> {
    const res = await this.request<{ data: ApiDelulu[] }>(
      `/users/${address}/staked`
    );
    return res.data;
  }

  // ============ Delulus ============

  async getDelulus(options?: {
    limit?: number;
    cursor?: string;
    creator?: string;
    includeResolved?: boolean;
  }): Promise<PaginatedResponse<ApiDelulu>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.cursor) params.set("cursor", options.cursor);
    if (options?.creator) params.set("creator", options.creator);
    if (options?.includeResolved === false) params.set("includeResolved", "false");

    const query = params.toString();
    return this.request<PaginatedResponse<ApiDelulu>>(
      `/delulus${query ? `?${query}` : ""}`
    );
  }

  async getDelulu(id: string): Promise<ApiDelulu | null> {
    try {
      return await this.request<ApiDelulu>(`/delulus/${id}`);
    } catch {
      return null;
    }
  }

  async createDelulu(data: {
    onChainId: string;
    contentHash: string;
    content?: string;
    creatorAddress: string;
    stakingDeadline: string;
    resolutionDeadline: string;
    bgImageUrl?: string;
    gatekeeper?: {
      enabled: boolean;
      type?: string;
      value?: string;
      label?: string;
    };
  }): Promise<ApiDelulu> {
    return this.request<ApiDelulu>("/delulus", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getTrendingDelulus(limit = 10): Promise<ApiDelulu[]> {
    const res = await this.request<{ data: ApiDelulu[] }>(
      `/delulus/trending?limit=${limit}`
    );
    return res.data;
  }

  async getDelulusByState(
    state: DeluluState,
    options?: { limit?: number; cursor?: string }
  ): Promise<PaginatedResponse<ApiDelulu>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.cursor) params.set("cursor", options.cursor);

    const query = params.toString();
    return this.request<PaginatedResponse<ApiDelulu>>(
      `/delulus/state/${state}${query ? `?${query}` : ""}`
    );
  }

  // ============ Stakes ============

  async getUserStakes(address: string): Promise<ApiStake[]> {
    return this.request<ApiStake[]>(`/stakes?address=${address}`);
  }

  async getUserPosition(
    address: string,
    deluluId: string
  ): Promise<UserPosition> {
    return this.request<UserPosition>(
      `/stakes?address=${address}&deluluId=${deluluId}`
    );
  }

  async createStake(data: {
    userAddress: string;
    deluluId: string;
    amount: number;
    side: boolean;
    txHash: string;
  }): Promise<ApiStake> {
    return this.request<ApiStake>("/stakes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getDeluluStakes(deluluId: string): Promise<ApiStake[]> {
    return this.request<ApiStake[]>(`/delulus/${deluluId}/stakes`);
  }

  // ============ Claims ============

  async getUserClaims(address: string): Promise<ApiClaim[]> {
    return this.request<ApiClaim[]>(`/claims?address=${address}`);
  }

  async getTotalClaimed(address: string): Promise<number> {
    const res = await this.request<{ total: number }>(
      `/claims?address=${address}&total=true`
    );
    return res.total;
  }

  async createClaim(data: {
    userAddress: string;
    deluluId: string;
    amount: number;
    txHash: string;
  }): Promise<ApiClaim> {
    return this.request<ApiClaim>("/claims", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ============ Stats ============

  async getUserStats(address: string): Promise<ApiStats> {
    return this.request<ApiStats>(`/stats?address=${address}`);
  }

  async getPlatformStats(): Promise<PlatformStats> {
    return this.request<PlatformStats>("/stats/platform");
  }

  // ============ Leaderboard ============

  async getLeaderboard(
    type: LeaderboardType = "stakers",
    limit = 10
  ): Promise<LeaderboardEntry[]> {
    const res = await this.request<{ data: LeaderboardEntry[] }>(
      `/leaderboard?type=${type}&limit=${limit}`
    );
    return res.data;
  }

  // ============ Activity ============

  async getActivity(options?: {
    address?: string;
    limit?: number;
  }): Promise<ActivityItem[]> {
    const params = new URLSearchParams();
    if (options?.address) params.set("address", options.address);
    if (options?.limit) params.set("limit", options.limit.toString());

    const query = params.toString();
    const res = await this.request<{ data: ActivityItem[] }>(
      `/activity${query ? `?${query}` : ""}`
    );
    return res.data;
  }
}

export const api = new ApiClient();
