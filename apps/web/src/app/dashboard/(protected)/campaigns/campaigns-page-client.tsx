"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, ExternalLink, Megaphone } from "lucide-react";
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
import {
  useDashboardCampaigns,
  useToggleCampaignHidden,
} from "@/hooks/dashboard/use-dashboard-campaigns";
import { cn } from "@/lib/utils";

export function CampaignsPageClient() {
  const { data: campaigns = [], isLoading } = useDashboardCampaigns();
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

  return (
    <DashboardPage>
      <DashboardPageHeader title="Campaigns" />

      {isLoading ? (
        <DashboardTableLoading />
      ) : campaigns.length === 0 ? (
        <DashboardTableCard>
          <DashboardTableEmptyState icon={Megaphone} title="No campaigns yet" />
        </DashboardTableCard>
      ) : (
        <DashboardTableCard>
          <DashboardTableScroll>
            <DashboardTableHead>
              <DashboardTableHeadRow>
                <DashboardTableHeadCell>Campaign</DashboardTableHeadCell>
                <DashboardTableHeadCell>Community</DashboardTableHeadCell>
                <DashboardTableHeadCell>Status</DashboardTableHeadCell>
                <DashboardTableHeadCell>Visibility</DashboardTableHeadCell>
                <DashboardTableHeadCell align="right">Actions</DashboardTableHeadCell>
              </DashboardTableHeadRow>
            </DashboardTableHead>
            <DashboardTableBody>
              {campaigns.map((c) => {
                const busy = isPending && variables?.id === c.id;
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
        </DashboardTableCard>
      )}
    </DashboardPage>
  );
}
