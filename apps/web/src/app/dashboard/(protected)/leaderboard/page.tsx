"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Gift,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { formatAddress } from "@/lib/utils";
import { RewardUserModal } from "@/components/admin/reward-user-modal";
import { useDashboardToast } from "@/components/dashboard/dashboard-toast";
import {
  DashboardPage,
  DashboardPageHeader,
  DashboardTableCard,
  DashboardTableLoading,
  DashboardTableEmptyState,
  DashboardTableScroll,
  DashboardTableHead,
  DashboardTableHeadRow,
  DashboardTableHeadCell,
  DashboardTableBody,
  DashboardTableRow,
  DashboardTableCell,
} from "@/components/dashboard/dashboard-ui";

type LeaderboardRow = {
  rank: number;
  wallet_address: string;
  points_total: number;
  username: string | null;
};

type SearchUserRow = {
  address: string;
  username: string | null;
  email: string;
  pfp_url: string | null;
};

type RewardTarget = {
  address: string;
  username: string | null;
};

export default function AdminLeaderboardPage() {
  const [topRows, setTopRows] = useState<LeaderboardRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingTop, setLoadingTop] = useState(true);
  const [topError, setTopError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUserRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [rewardTarget, setRewardTarget] = useState<RewardTarget | null>(null);
  const { show: showToast } = useDashboardToast();

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const loadTop = useCallback(async () => {
    setLoadingTop(true);
    setTopError(null);
    try {
      const res = await fetch("/api/dashboard/leaderboard", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? `Request failed: ${res.status}`);
      }
      setTopRows((json as { leaderboard: LeaderboardRow[] }).leaderboard ?? []);
      setTotalCount((json as { totalCount?: number }).totalCount ?? 0);
    } catch (err) {
      setTopError(err instanceof Error ? err.message : "Failed to load leaderboard");
      setTopRows([]);
    } finally {
      setLoadingTop(false);
    }
  }, []);

  useEffect(() => {
    void loadTop();
  }, [loadTop]);

  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    setSearchError(null);

    void (async () => {
      try {
        const params = new URLSearchParams({
          query: debouncedSearch,
          page: "1",
        });
        const res = await fetch(`/api/dashboard/users?${params}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((json as { error?: string }).error ?? `Search failed: ${res.status}`);
        }
        if (!cancelled) {
          setSearchResults((json as { users: SearchUserRow[] }).users ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setSearchError(err instanceof Error ? err.message : "Search failed");
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const openReward = (address: string, username: string | null) => {
    setRewardTarget({ address, username });
  };

  return (
    <DashboardPage className="max-w-none px-5 sm:px-7">
      <DashboardPageHeader title="Leaderboard" />
      <p className="-mt-4 mb-6 text-sm text-muted-foreground">
        Top campaign performers this month — search anyone and send a claimable reward.
      </p>

      {/* Search any user */}
      <section className="mb-6 space-y-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username, email, or wallet…"
            className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {debouncedSearch ? (
          <DashboardTableCard>
            {searchLoading ? (
              <DashboardTableLoading />
            ) : searchError ? (
              <DashboardTableEmptyState title="Search failed" description={searchError} />
            ) : searchResults.length === 0 ? (
              <DashboardTableEmptyState
                title="No users found"
                description="Try a different username, email, or address."
              />
            ) : (
              <DashboardTableScroll>
                <table className="w-full min-w-[640px] text-left text-sm">
                  <DashboardTableHead>
                    <DashboardTableHeadRow>
                      <DashboardTableHeadCell>User</DashboardTableHeadCell>
                      <DashboardTableHeadCell>Wallet</DashboardTableHeadCell>
                      <DashboardTableHeadCell className="w-28 text-right">
                        Action
                      </DashboardTableHeadCell>
                    </DashboardTableHeadRow>
                  </DashboardTableHead>
                  <DashboardTableBody>
                    {searchResults.map((user) => (
                      <DashboardTableRow key={user.address}>
                        <DashboardTableCell>
                          <div className="flex items-center gap-2.5">
                            {user.pfp_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={user.pfp_url}
                                alt=""
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                                {(user.username ?? "?").slice(0, 1).toUpperCase()}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">
                                {user.username ? `@${user.username}` : "No username"}
                              </p>
                              {user.email ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {user.email}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </DashboardTableCell>
                        <DashboardTableCell className="font-mono text-xs text-muted-foreground">
                          {formatAddress(user.address as `0x${string}`)}
                        </DashboardTableCell>
                        <DashboardTableCell className="text-right">
                          <button
                            type="button"
                            onClick={() => openReward(user.address, user.username)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-delulu-blue px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                          >
                            <Gift className="h-3.5 w-3.5" />
                            Reward
                          </button>
                        </DashboardTableCell>
                      </DashboardTableRow>
                    ))}
                  </DashboardTableBody>
                </table>
              </DashboardTableScroll>
            )}
          </DashboardTableCard>
        ) : null}
      </section>

      {/* Top 20 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-delulu-blue" />
            <h2 className="text-sm font-bold text-foreground">Top 20 this month</h2>
            {totalCount > 0 ? (
              <span className="text-xs text-muted-foreground">
                {totalCount.toLocaleString()} ranked
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void loadTop()}
            disabled={loadingTop}
            className="text-xs font-semibold text-delulu-blue hover:underline disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        <DashboardTableCard>
          {loadingTop ? (
            <DashboardTableLoading />
          ) : topError ? (
            <DashboardTableEmptyState title="Couldn't load leaderboard" description={topError} />
          ) : topRows.length === 0 ? (
            <DashboardTableEmptyState
              title="No ranked users yet"
              description="Campaign points this month will show up here."
            />
          ) : (
            <DashboardTableScroll>
              <table className="w-full min-w-[640px] text-left text-sm">
                <DashboardTableHead>
                  <DashboardTableHeadRow>
                    <DashboardTableHeadCell className="w-16">Rank</DashboardTableHeadCell>
                    <DashboardTableHeadCell>User</DashboardTableHeadCell>
                    <DashboardTableHeadCell className="w-28 text-right">
                      Points
                    </DashboardTableHeadCell>
                    <DashboardTableHeadCell className="w-28 text-right">
                      Action
                    </DashboardTableHeadCell>
                  </DashboardTableHeadRow>
                </DashboardTableHead>
                <DashboardTableBody>
                  {topRows.map((row) => (
                    <DashboardTableRow key={row.wallet_address}>
                      <DashboardTableCell>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold tabular-nums text-foreground">
                          {row.rank}
                        </span>
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {row.username ? `@${row.username}` : "Anonymous"}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {formatAddress(row.wallet_address as `0x${string}`)}
                          </p>
                        </div>
                      </DashboardTableCell>
                      <DashboardTableCell className="text-right font-bold tabular-nums text-foreground">
                        {row.points_total.toLocaleString()}
                      </DashboardTableCell>
                      <DashboardTableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => openReward(row.wallet_address, row.username)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-delulu-blue px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                        >
                          <Gift className="h-3.5 w-3.5" />
                          Reward
                        </button>
                      </DashboardTableCell>
                    </DashboardTableRow>
                  ))}
                </DashboardTableBody>
              </table>
            </DashboardTableScroll>
          )}
        </DashboardTableCard>
      </section>

      {rewardTarget ? (
        <RewardUserModal
          userAddress={rewardTarget.address}
          username={rewardTarget.username}
          onClose={() => setRewardTarget(null)}
          onSuccess={(message) => {
            showToast(message);
            setRewardTarget(null);
          }}
        />
      ) : null}
    </DashboardPage>
  );
}
