"use client";

import { useState, useMemo } from "react";
import { Wallet, Search, X } from "lucide-react";
import {
  DashboardPage,
  DashboardPageHeader,
  DashboardStatGrid,
  DashboardStat,
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
  DashboardPrimaryButton,
  StatusChip,
} from "@/components/dashboard/dashboard-ui";
import { FundCampaignModal } from "@/components/dashboard/fund-campaign-modal";
import { useFundingQueue } from "@/hooks/dashboard/use-dashboard-campaigns";
import type { DashboardCampaign } from "@/hooks/dashboard/use-dashboard-campaigns";

export function FundingPageClient() {
  const { data: campaigns = [], isLoading, refetch } = useFundingQueue();
  const [search, setSearch] = useState("");
  const [fundTarget, setFundTarget] = useState<{
    id: string;
    title: string;
    proposed_pool_amount: number;
    content_hash: string | null;
    on_chain_challenge_id: number | null;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) => {
      const communityName = ((c as { communities?: { name?: string } }).communities?.name ?? c.community?.name ?? "").toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        communityName.includes(q)
      );
    });
  }, [campaigns, search]);

  const totalPool = useMemo(
    () => campaigns.reduce((sum, c) => sum + (c.proposed_pool_amount ?? 0), 0),
    [campaigns],
  );

  const uniqueCommunities = useMemo(
    () => new Set(campaigns.map((c) => c.community_id)).size,
    [campaigns],
  );

  const avgPool = campaigns.length > 0 ? Math.round(totalPool / campaigns.length) : 0;

  return (
    <DashboardPage className="max-w-none px-5 sm:px-7">
      <DashboardPageHeader title="Funding Queue" />

      <DashboardStatGrid>
        <DashboardStat label="Awaiting Fund" value={campaigns.length} isLoading={isLoading} />
        <DashboardStat label="Total Pool" value={`${totalPool.toLocaleString()} G$`} isLoading={isLoading} />
        <DashboardStat label="Avg Pool" value={`${avgPool.toLocaleString()} G$`} isLoading={isLoading} />
        <DashboardStat label="Communities" value={uniqueCommunities} isLoading={isLoading} />
      </DashboardStatGrid>

      <div className="mb-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search by campaign or community…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
            className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <DashboardTableCard>
        {isLoading ? (
          <DashboardTableLoading />
        ) : filtered.length === 0 ? (
          <DashboardTableEmptyState icon={Wallet} title={campaigns.length === 0 ? "No campaigns awaiting fund" : "No results for that search"} />
        ) : (
          <DashboardTableScroll minWidth="680px">
            <DashboardTableHead>
              <DashboardTableHeadRow>
                <DashboardTableHeadCell>Campaign</DashboardTableHeadCell>
                <DashboardTableHeadCell>Community</DashboardTableHeadCell>
                <DashboardTableHeadCell>Pool (G$)</DashboardTableHeadCell>
                <DashboardTableHeadCell>Duration</DashboardTableHeadCell>
                <DashboardTableHeadCell>Winners</DashboardTableHeadCell>
                <DashboardTableHeadCell>Status</DashboardTableHeadCell>
                <DashboardTableHeadCell align="right">Action</DashboardTableHeadCell>
              </DashboardTableHeadRow>
            </DashboardTableHead>
            <DashboardTableBody>
              {filtered.map((c: DashboardCampaign) => {
                const communityName =
                  (c as { communities?: { name?: string } }).communities?.name ??
                  c.community?.name ??
                  "—";
                return (
                  <DashboardTableRow key={c.id}>
                    <DashboardTableCell className="max-w-[200px]">
                      <p className="truncate font-semibold text-foreground">{c.title}</p>
                      {c.description ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.description}</p>
                      ) : null}
                    </DashboardTableCell>
                    <DashboardTableCell>
                      <span className="text-sm text-muted-foreground">{communityName}</span>
                    </DashboardTableCell>
                    <DashboardTableCell>
                      <span className="tabular-nums font-semibold text-foreground">
                        {c.proposed_pool_amount > 0 ? c.proposed_pool_amount.toLocaleString() : "—"}
                      </span>
                    </DashboardTableCell>
                    <DashboardTableCell>
                      <span className="text-sm text-muted-foreground">
                        {c.duration_days}d
                      </span>
                    </DashboardTableCell>
                    <DashboardTableCell>
                      <span className="text-sm text-muted-foreground">
                        Top {c.prize_winner_count}
                      </span>
                    </DashboardTableCell>
                    <DashboardTableCell>
                      <StatusChip status={c.status} />
                    </DashboardTableCell>
                    <DashboardTableCell align="right">
                      <DashboardPrimaryButton
                        className="py-1.5 px-3 text-xs"
                        onClick={() =>
                          setFundTarget({
                            id: c.id,
                            title: c.title,
                            proposed_pool_amount: c.proposed_pool_amount,
                            content_hash: c.content_hash,
                            on_chain_challenge_id: c.on_chain_challenge_id ?? null,
                          })
                        }
                      >
                        Fund
                      </DashboardPrimaryButton>
                    </DashboardTableCell>
                  </DashboardTableRow>
                );
              })}
            </DashboardTableBody>
          </DashboardTableScroll>
        )}
      </DashboardTableCard>

      <FundCampaignModal
        open={Boolean(fundTarget)}
        onOpenChange={(open) => !open && setFundTarget(null)}
        campaign={fundTarget}
        onSuccess={() => {
          setFundTarget(null);
          void refetch();
        }}
      />
    </DashboardPage>
  );
}
