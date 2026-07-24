"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatUnits } from "viem";
import { AlertTriangle, Eye, EyeOff, ExternalLink, Megaphone, Search, X } from "lucide-react";
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
  StatusChip,
  useDashboardToast,
} from "@/components/dashboard/dashboard-ui";
import { AdminPagination } from "@/components/admin/admin-ui";
import {
  useDashboardCampaignsPaginated,
  useDashboardCampaignsOnchainStatus,
  useToggleCampaignHidden,
} from "@/hooks/dashboard/use-dashboard-campaigns";
import { cn } from "@/lib/utils";

function formatGd(wei: string) {
  return parseFloat(formatUnits(BigInt(wei), 18)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export function CampaignsPageClient() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useDashboardCampaignsPaginated({ query: search, page });
  const campaigns = data?.campaigns ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const { data: onchainStatus = {} } = useDashboardCampaignsOnchainStatus(
    campaigns.map((c) => c.id),
  );
  const { mutate: toggleHidden, isPending, variables } = useToggleCampaignHidden();
  const { show } = useDashboardToast();

  const handleToggle = (id: string, nextHidden: boolean) => {
    toggleHidden(
      { id, isHidden: nextHidden },
      {
        onSuccess: () => show(nextHidden ? "Campaign hidden" : "Campaign visible again"),
        onError: (err) => show(err instanceof Error ? err.message : "Failed to update campaign"),
      },
    );
  };

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  return (
    <DashboardPage>
      <DashboardPageHeader title="Campaigns" />

      <div className="mb-5 w-full sm:w-72">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search by title…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search ? (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <DashboardTableLoading />
      ) : campaigns.length === 0 ? (
        <DashboardTableCard>
          <DashboardTableEmptyState
            icon={Megaphone}
            title={search ? "No campaigns match your search" : "No campaigns yet"}
          />
        </DashboardTableCard>
      ) : (
        <DashboardTableCard>
          <DashboardTableScroll>
            <DashboardTableHead>
              <DashboardTableHeadRow>
                <DashboardTableHeadCell>Campaign</DashboardTableHeadCell>
                <DashboardTableHeadCell>Community</DashboardTableHeadCell>
                <DashboardTableHeadCell>Status</DashboardTableHeadCell>
                <DashboardTableHeadCell>Join</DashboardTableHeadCell>
                <DashboardTableHeadCell>Pool</DashboardTableHeadCell>
                <DashboardTableHeadCell>Visibility</DashboardTableHeadCell>
                <DashboardTableHeadCell align="right">Actions</DashboardTableHeadCell>
              </DashboardTableHeadRow>
            </DashboardTableHead>
            <DashboardTableBody>
              {campaigns.map((c) => {
                const busy = isPending && variables?.id === c.id;
                const health = onchainStatus[c.id];
                const isPaidCampaign = c.is_free_to_join === false && (c.join_amount ?? 0) > 0;
                return (
                  <DashboardTableRow key={c.id}>
                    <DashboardTableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        {c.cover_image_url ? (
                          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                            <Image
                              src={c.cover_image_url}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Megaphone className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="min-w-0 truncate font-medium text-foreground">
                          {c.title}
                        </span>
                      </div>
                    </DashboardTableCell>

                    <DashboardTableCell>
                      <span className="text-muted-foreground">
                        {c.community?.name ?? "—"}
                      </span>
                    </DashboardTableCell>

                    <DashboardTableCell>
                      <StatusChip status={c.status} />
                    </DashboardTableCell>

                    <DashboardTableCell>
                      {c.on_chain_challenge_id == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={cn(
                              "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              isPaidCampaign
                                ? "bg-delulu-blue-light text-delulu-blue"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {isPaidCampaign ? `Paid · ${c.join_amount} ${c.join_token ?? "G$"}` : "Free"}
                          </span>
                          {health && isPaidCampaign ? (
                            <span className="text-[10px] text-muted-foreground">
                              {formatGd(health.totalStakedWei)} {c.join_token ?? "G$"} staked
                            </span>
                          ) : null}
                          {health?.economicsDrift ? (
                            <span
                              className="inline-flex w-fit items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600"
                              title={
                                health.economicsStillFixable
                                  ? "Paid economics never landed on-chain — still fixable from the campaign page."
                                  : "Paid economics never landed on-chain — locked now that people have joined for free."
                              }
                            >
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {health.economicsStillFixable ? "Fixable" : "Never charged"}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </DashboardTableCell>

                    <DashboardTableCell>
                      {c.on_chain_challenge_id == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : !health ? (
                        <span className="text-muted-foreground">…</span>
                      ) : health.needsFunding ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600"
                          title="Prize pool is empty on-chain — winners have nothing to claim yet."
                        >
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Needs funding
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-foreground">
                          {formatGd(health.poolAmountWei)} G$
                        </span>
                      )}
                    </DashboardTableCell>

                    <DashboardTableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          c.is_hidden ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600",
                        )}
                      >
                        {c.is_hidden ? "Hidden" : "Visible"}
                      </span>
                    </DashboardTableCell>

                    <DashboardTableCell align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleToggle(c.id, !c.is_hidden)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
                            c.is_hidden
                              ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                              : "border-amber-200 text-amber-600 hover:bg-amber-50",
                          )}
                        >
                          {c.is_hidden ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                          {c.is_hidden ? "Unhide" : "Hide"}
                        </button>

                        <Link
                          href={`/dashboard/communities/${c.community_id}/campaigns/${c.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#e8e8e3] px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Details
                        </Link>
                      </div>
                    </DashboardTableCell>
                  </DashboardTableRow>
                );
              })}
            </DashboardTableBody>
          </DashboardTableScroll>
          <AdminPagination page={page} totalPages={totalPages} onPage={setPage} />
        </DashboardTableCard>
      )}
    </DashboardPage>
  );
}
