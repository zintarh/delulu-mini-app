"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CAMPAIGN_DURATION_OPTIONS,
  PRIZE_WINNER_COUNTS,
  type CampaignDurationDays,
  type PrizeWinnerCount,
} from "@/lib/community/campaign-types";
import { CampaignCoverUpload } from "@/components/dashboard/campaign-cover-upload";
import {
  DashboardPage,
  DashboardStatGrid,
  DashboardStat,
  DashboardPanel,
  DashboardTableScroll,
  DashboardTableHead,
  DashboardTableHeadRow,
  DashboardTableHeadCell,
  DashboardTableBody,
  DashboardTableRow,
  DashboardTableCell,
  DashboardField,
  DashboardPrimaryButton,
  DashboardSelect,
  StatusChip,
  hasTableCellValue,
  dashboardInputClass,
  useDashboardToast,
} from "@/components/dashboard/dashboard-ui";
import {
  useDashboardCampaign,
  useUpdateCampaign,
  type DashboardCampaign,
} from "@/hooks/dashboard/use-dashboard-campaigns";

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const TIMELINE = ["pending_approval", "approved", "active", "ended"] as const;
type DetailTab = "overview" | "settings";

function CampaignSettingsForm({
  campaign,
  campaignId,
}: {
  campaign: DashboardCampaign & { communities?: { name?: string } };
  campaignId: string;
}) {
  const update = useUpdateCampaign(campaignId);
  const { show } = useDashboardToast();
  const canEditMetadata =
    campaign.status === "draft" ||
    campaign.status === "rejected" ||
    campaign.status === "pending_approval";
  const canEditCover = campaign.status !== "ended";

  const [title, setTitle] = useState(campaign.title);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    campaign.cover_image_url ?? null,
  );
  const [cadence, setCadence] = useState<"daily" | "weekly">(
    campaign.proof_cadence === "weekly" ? "weekly" : "daily",
  );
  const [durationDays, setDurationDays] = useState<CampaignDurationDays>(
    (campaign.duration_days as CampaignDurationDays) ?? 30,
  );
  const [prizeWinnerCount, setPrizeWinnerCount] = useState<PrizeWinnerCount>(
    (campaign.prize_winner_count as PrizeWinnerCount) ?? 10,
  );
  const [proofInstructions, setProofInstructions] = useState(
    campaign.proof_instructions ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(campaign.title);
    setCoverImageUrl(campaign.cover_image_url ?? null);
    setCadence(campaign.proof_cadence === "weekly" ? "weekly" : "daily");
    setDurationDays((campaign.duration_days as CampaignDurationDays) ?? 30);
    setPrizeWinnerCount((campaign.prize_winner_count as PrizeWinnerCount) ?? 10);
    setProofInstructions(campaign.proof_instructions ?? "");
  }, [campaign]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        ...(canEditCover ? { coverImageUrl } : {}),
        ...(canEditMetadata
          ? {
              title: title.trim(),
              proofCadence: cadence,
              proofInstructions: proofInstructions.trim(),
              durationDays,
              prizeWinnerCount,
            }
          : {}),
      });
      show("Campaign settings saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  if (!canEditCover && !canEditMetadata) {
    return (
      <DashboardPanel>
        <p className="py-8 text-center text-sm text-muted-foreground">
          This campaign cannot be edited.
        </p>
      </DashboardPanel>
    );
  }

  return (
    <DashboardPanel>
      <form className="space-y-4 p-4" onSubmit={(e) => void handleSave(e)}>
        {canEditCover ? (
          <DashboardField label="Cover image">
            <CampaignCoverUpload
              value={coverImageUrl}
              onChange={setCoverImageUrl}
              disabled={update.isPending}
              size="small"
            />
          </DashboardField>
        ) : null}

        {canEditMetadata ? (
          <>
            <DashboardField label="Title" required>
              <input
                className={dashboardInputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </DashboardField>

            <DashboardField label="Cadence" required>
              <DashboardSelect
                value={cadence}
                onChange={(e) => setCadence(e.target.value as "daily" | "weekly")}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </DashboardSelect>
            </DashboardField>

            <DashboardField label="Duration" required>
              <DashboardSelect
                value={durationDays}
                onChange={(e) =>
                  setDurationDays(Number(e.target.value) as CampaignDurationDays)
                }
              >
                {CAMPAIGN_DURATION_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days} days
                  </option>
                ))}
              </DashboardSelect>
            </DashboardField>

            <DashboardField label="Prize split" required>
              <DashboardSelect
                value={prizeWinnerCount}
                onChange={(e) =>
                  setPrizeWinnerCount(Number(e.target.value) as PrizeWinnerCount)
                }
              >
                {PRIZE_WINNER_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    Top {n}
                  </option>
                ))}
              </DashboardSelect>
            </DashboardField>

            <DashboardField label="Proof instructions">
              <textarea
                rows={3}
                className={cn(dashboardInputClass, "resize-none")}
                value={proofInstructions}
                onChange={(e) => setProofInstructions(e.target.value)}
              />
            </DashboardField>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Metadata can only be edited while the campaign is a draft, pending approval, or
            rejected.
          </p>
        )}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <DashboardPrimaryButton type="submit" disabled={update.isPending}>
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save settings
        </DashboardPrimaryButton>
      </form>
    </DashboardPanel>
  );
}

export function CampaignDetailClient({
  communityId,
  campaignId,
}: {
  communityId: string;
  campaignId: string;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const searchParams = useSearchParams();
  const { data, isLoading } = useDashboardCampaign(campaignId);
  const campaign = data?.campaign;
  const leaderboard = data?.leaderboard ?? [];

  useEffect(() => {
    if (searchParams.get("tab") === "settings") {
      setActiveTab("settings");
    }
  }, [searchParams]);

  if (isLoading || !campaign) {
    return (
      <DashboardPage>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </DashboardPage>
    );
  }

  const communityName =
    (campaign as { communities?: { name?: string } }).communities?.name ?? "Community";
  const timelineIndex = TIMELINE.indexOf(campaign.status as (typeof TIMELINE)[number]);

  return (
    <DashboardPage>
      <Link
        href={`/dashboard/communities/${communityId}`}
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {communityName}
      </Link>

      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">{campaign.title}</h1>
          <StatusChip status={campaign.status} />
        </div>
        {campaign.description ? (
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{campaign.description}</p>
        ) : null}
      </div>

      {campaign.cover_image_url ? (
        <div className="relative mb-6 h-32 w-full overflow-hidden rounded-xl border border-[#e8e8e3]">
          <Image
            src={campaign.cover_image_url}
            alt=""
            fill
            className="object-cover"
            unoptimized
            priority
          />
        </div>
      ) : null}

      <div className="mb-6 flex gap-2 border-b border-[#e8e8e3]">
        {(["overview", "settings"] as DetailTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold capitalize transition-colors",
              activeTab === tab
                ? "border-delulu-blue text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "settings" ? (
        <CampaignSettingsForm campaign={campaign} campaignId={campaignId} />
      ) : (
        <>
          <div className="mb-6 flex items-center gap-2">
            {TIMELINE.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    timelineIndex >= i ? "bg-delulu-blue" : "bg-[#e8e8e3]"
                  }`}
                  title={step.replace(/_/g, " ")}
                />
                {i < TIMELINE.length - 1 ? (
                  <div className="h-px w-8 bg-[#e8e8e3] sm:w-12" />
                ) : null}
              </div>
            ))}
          </div>

          <DashboardStatGrid>
            <DashboardStat
              label="Pool"
              value={
                campaign.proposed_pool_amount > 0
                  ? `${campaign.proposed_pool_amount} G$`
                  : "Set at funding"
              }
            />
            <DashboardStat label="Cadence" value={campaign.proof_cadence} />
            <DashboardStat label="Duration" value={`${campaign.duration_days ?? 30}d`} />
            <DashboardStat label="Top winners" value={campaign.prize_winner_count ?? 10} />
            <DashboardStat label="Participants" value={leaderboard.length} />
            <DashboardStat
              label="On-chain"
              value={
                hasTableCellValue(campaign.on_chain_challenge_id)
                  ? `#${campaign.on_chain_challenge_id}`
                  : "—"
              }
            />
          </DashboardStatGrid>

          {campaign.proof_instructions ? (
            <p className="mb-4 text-sm text-muted-foreground">{campaign.proof_instructions}</p>
          ) : null}

          {campaign.rejection_reason ? (
            <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              Rejected: {campaign.rejection_reason}
            </p>
          ) : null}

          <h2 className="mb-3 text-sm font-semibold text-foreground">Leaderboard</h2>
          <DashboardPanel>
            {leaderboard.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No participants yet
              </p>
            ) : (
              <DashboardTableScroll>
                <DashboardTableHead>
                  <DashboardTableHeadRow>
                    <DashboardTableHeadCell>#</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Wallet</DashboardTableHeadCell>
                    <DashboardTableHeadCell align="right">Points</DashboardTableHeadCell>
                  </DashboardTableHeadRow>
                </DashboardTableHead>
                <DashboardTableBody>
                  {leaderboard.map((row, index) => (
                    <DashboardTableRow key={row.wallet_address}>
                      <DashboardTableCell>{index + 1}</DashboardTableCell>
                      <DashboardTableCell className="font-mono text-xs">
                        {formatAddress(row.wallet_address)}
                      </DashboardTableCell>
                      <DashboardTableCell align="right" className="font-bold tabular-nums">
                        {row.points_total}
                      </DashboardTableCell>
                    </DashboardTableRow>
                  ))}
                </DashboardTableBody>
              </DashboardTableScroll>
            )}
          </DashboardPanel>
        </>
      )}
    </DashboardPage>
  );
}
