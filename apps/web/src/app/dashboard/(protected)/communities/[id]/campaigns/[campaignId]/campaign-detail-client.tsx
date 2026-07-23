"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2, Sparkles, StopCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLeaderboardDisplayName } from "@/lib/community/enrich-leaderboard-usernames";
import {
  canDeleteDashboardCampaign,
  canEndDashboardCampaign,
  canPublishDashboardPayouts,
} from "@/lib/dashboard/campaign-constants";
import {
  CAMPAIGN_DURATION_OPTIONS,
  PRIZE_WINNER_COUNTS,
  LIVE_CAMERA_DURATION_MINUTES,
  type CampaignDurationDays,
  type PrizeWinnerCount,
  type ProofType,
  type LiveCameraDurationMinutes,
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
  DashboardModal,
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
import { useEndCommunityChallenge, useSetCommunityPayoutRoot } from "@/hooks/use-community-campaign-onchain";
import { CampaignMilestonesModal } from "@/components/dashboard/campaign-milestones-modal";
import { DeleteCampaignModal } from "@/components/dashboard/delete-campaign-modal";
import { ApproveCampaignModal } from "@/components/dashboard/approve-campaign-modal";
import type { CommunityCampaignMilestoneRow } from "@/lib/community/campaign-subgraph";

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
  const [proofType, setProofType] = useState<ProofType>(
    campaign.proof_type === "live_camera" ? "live_camera" : "screenshot",
  );
  const [liveCameraDurationMinutes, setLiveCameraDurationMinutes] =
    useState<LiveCameraDurationMinutes>(
      (Math.round((campaign.live_camera_duration_seconds ?? 60) / 60) as LiveCameraDurationMinutes) || 1,
    );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(campaign.title);
    setCoverImageUrl(campaign.cover_image_url ?? null);
    setCadence(campaign.proof_cadence === "weekly" ? "weekly" : "daily");
    setDurationDays((campaign.duration_days as CampaignDurationDays) ?? 30);
    setPrizeWinnerCount((campaign.prize_winner_count as PrizeWinnerCount) ?? 10);
    setProofInstructions(campaign.proof_instructions ?? "");
    setProofType(campaign.proof_type === "live_camera" ? "live_camera" : "screenshot");
    setLiveCameraDurationMinutes(
      (Math.round((campaign.live_camera_duration_seconds ?? 60) / 60) as LiveCameraDurationMinutes) || 1,
    );
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
              proofType,
              liveCameraDurationMinutes:
                proofType === "live_camera" ? liveCameraDurationMinutes : undefined,
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

        <DashboardField label="Proof verification">
          {canEditMetadata ? (
            <>
              <div className="flex gap-2">
                {(["screenshot", "live_camera"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setProofType(type)}
                    className={cn(
                      "flex-1 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                      proofType === type
                        ? "border-delulu-blue bg-delulu-blue text-white"
                        : "border-border bg-background text-foreground hover:bg-muted/50",
                    )}
                  >
                    {type === "screenshot" ? "Screenshot upload" : "Live camera recording"}
                  </button>
                ))}
              </div>
              {proofType === "live_camera" ? (
                <div className="mt-3 w-40">
                  <DashboardField label="Recording length">
                    <DashboardSelect
                      value={liveCameraDurationMinutes}
                      onChange={(e) =>
                        setLiveCameraDurationMinutes(
                          Number(e.target.value) as LiveCameraDurationMinutes,
                        )
                      }
                    >
                      {LIVE_CAMERA_DURATION_MINUTES.map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes} minute{minutes > 1 ? "s" : ""}
                        </option>
                      ))}
                    </DashboardSelect>
                  </DashboardField>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm font-semibold text-foreground">
              {campaign.proof_type === "live_camera"
                ? `Live camera recording (${Math.round((campaign.live_camera_duration_seconds ?? 60) / 60)} min)`
                : "Screenshot upload"}
            </p>
          )}
        </DashboardField>

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
  isPlatformAdmin,
}: {
  communityId: string;
  campaignId: string;
  isPlatformAdmin: boolean;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [milestonesModalOpen, setMilestonesModalOpen] = useState(false);
  const [milestonesAutoGenerate, setMilestonesAutoGenerate] = useState(false);
  const [milestones, setMilestones] = useState<CommunityCampaignMilestoneRow[]>([]);
  const [milestoneCount, setMilestoneCount] = useState(0);
  const [endStep, setEndStep] = useState<
    "idle" | "signing" | "confirming" | "done" | "error"
  >("idle");
  const [endError, setEndError] = useState<string | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishStep, setPublishStep] = useState<
    "idle" | "building" | "signing" | "confirming" | "done" | "error"
  >("idle");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [submitPending, setSubmitPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data, isLoading, refetch } = useDashboardCampaign(campaignId);
  const campaign = data?.campaign;
  const leaderboard = data?.leaderboard ?? [];
  const { endCommunityChallenge, isPending: isEndingOnChain } = useEndCommunityChallenge();
  const { setCommunityPayoutRootAndWait, isPending: isPublishingRoot } =
    useSetCommunityPayoutRoot();

  const handleEndCampaign = async () => {
    if (campaign?.on_chain_challenge_id == null) return;
    setEndStep("signing");
    setEndError(null);
    try {
      const hash = await endCommunityChallenge(campaign.on_chain_challenge_id);
      setEndStep("confirming");
      const res = await fetch(`/api/dashboard/campaigns/${campaignId}/confirm-end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: hash }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? "Failed to confirm end");
      }

      setEndStep("done");
      void refetch();
    } catch (err) {
      setEndStep("error");
      setEndError(err instanceof Error ? err.message : "Failed to end campaign");
    }
  };

  // Deliberately a separate action from ending, triggered whenever the admin is
  // ready — gives participants a real window to call claimCommunityJoinStake
  // first. Any stake they forfeit for missed milestones lands in poolAmount,
  // and rebuilding the snapshot right before publishing (rather than
  // immediately at end) is what lets that actually reach winners.
  const handlePublishPayouts = async () => {
    if (campaign?.on_chain_challenge_id == null) return;
    setPublishStep("building");
    setPublishError(null);
    try {
      const buildRes = await fetch(
        `/api/dashboard/campaigns/${campaignId}/build-payout-snapshot`,
        { method: "POST" },
      );
      const buildJson = await buildRes.json().catch(() => ({}));
      if (!buildRes.ok) {
        throw new Error((buildJson as { error?: string }).error ?? "Failed to build payout snapshot");
      }
      const { merkleRoot, totalClaimableWei } = buildJson as {
        merkleRoot: string;
        totalClaimableWei: string;
      };

      setPublishStep("signing");
      const rootHash = await setCommunityPayoutRootAndWait({
        challengeId: campaign.on_chain_challenge_id,
        merkleRoot: merkleRoot as `0x${string}`,
        totalClaimableWei: BigInt(totalClaimableWei),
      });

      setPublishStep("confirming");
      const pubRes = await fetch(
        `/api/dashboard/campaigns/${campaignId}/confirm-payout-root`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash: rootHash, merkleRoot }),
        },
      );
      if (!pubRes.ok) {
        const pubJson = await pubRes.json().catch(() => ({}));
        throw new Error((pubJson as { error?: string }).error ?? "Failed to confirm payout root");
      }

      setPublishStep("done");
      void refetch();
    } catch (err) {
      setPublishStep("error");
      setPublishError(err instanceof Error ? err.message : "Failed to publish payouts");
    }
  };

  const handleSubmitForApproval = async () => {
    setSubmitPending(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/dashboard/campaigns/${campaignId}/submit`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to submit");
      void refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitPending(false);
    }
  };

  useEffect(() => {
    if (searchParams.get("tab") === "settings") {
      setActiveTab("settings");
    }
  }, [searchParams]);

  useEffect(() => {
    if (campaign?.on_chain_challenge_id == null) return;
    void (async () => {
      const res = await fetch(`/api/community/campaigns/${campaignId}/my-proofs`);
      if (!res.ok) return;
      const json = await res.json();
      setMilestones(json.milestones ?? []);
      setMilestoneCount(json.milestoneCount ?? 0);
    })();
  }, [campaign?.on_chain_challenge_id, campaignId, milestonesModalOpen]);

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
  const canDelete = canDeleteDashboardCampaign(campaign.status);
  const canEnd = canEndDashboardCampaign(campaign.status, campaign.on_chain_challenge_id);
  const canPublish = canPublishDashboardPayouts(
    campaign.status,
    campaign.on_chain_challenge_id,
    campaign.payout_published_at,
  );

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
          {canDelete ? (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ) : null}
        </div>
        {campaign.description ? (
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{campaign.description}</p>
        ) : null}
      </div>

      <DashboardModal
        open={endModalOpen}
        onOpenChange={(o: boolean) => {
          if (!isEndingOnChain && endStep !== "confirming") {
            setEndModalOpen(o);
          }
        }}
        title="End campaign"
        description={`This will permanently close "${campaign.title}" on-chain. Participants will have a window to reclaim their join stake before you publish winner payouts separately.`}
      >
        <div className="space-y-4 pt-2 text-sm">
          {endStep === "done" ? (
            <p className="font-semibold text-emerald-700">
              Campaign ended. Participants can now reclaim their stake — publish payouts whenever
              you&apos;re ready from the Settings tab.
            </p>
          ) : null}
          {endError ? <p className="text-xs text-destructive">{endError}</p> : null}
          {endStep !== "done" ? (
            <DashboardPrimaryButton
              className="w-full bg-red-600 hover:bg-red-700"
              disabled={isEndingOnChain || endStep === "signing" || endStep === "confirming"}
              onClick={() => void handleEndCampaign()}
            >
              {isEndingOnChain || endStep === "signing" || endStep === "confirming" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {endStep === "confirming" ? "Confirming…" : "Confirm end campaign"}
            </DashboardPrimaryButton>
          ) : null}
        </div>
      </DashboardModal>

      <DashboardModal
        open={publishModalOpen}
        onOpenChange={(o: boolean) => {
          if (!isPublishingRoot && publishStep !== "building" && publishStep !== "confirming") {
            setPublishModalOpen(o);
          }
        }}
        title="Publish winner payouts"
        description={`This locks in the current prize pool for "${campaign.title}" (including any stake forfeited by participants who missed milestones) and publishes it on-chain so winners can claim. This can't be undone.`}
      >
        <div className="space-y-4 pt-2 text-sm">
          {publishStep === "done" ? (
            <p className="font-semibold text-emerald-700">
              Payouts published — winners in the prize zone can now claim.
            </p>
          ) : null}
          {publishError ? <p className="text-xs text-destructive">{publishError}</p> : null}
          {publishStep !== "done" ? (
            <DashboardPrimaryButton
              className="w-full"
              disabled={
                isPublishingRoot ||
                publishStep === "building" ||
                publishStep === "signing" ||
                publishStep === "confirming"
              }
              onClick={() => void handlePublishPayouts()}
            >
              {isPublishingRoot ||
              publishStep === "building" ||
              publishStep === "signing" ||
              publishStep === "confirming" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {publishStep === "building"
                ? "Building payout snapshot…"
                : publishStep === "confirming"
                  ? "Confirming…"
                  : "Publish payouts"}
            </DashboardPrimaryButton>
          ) : null}
        </div>
      </DashboardModal>

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
        <div className="space-y-4">
          <CampaignSettingsForm campaign={campaign} campaignId={campaignId} />
          {canEnd ? (
            <DashboardPanel>
              <div className="space-y-3 p-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">End campaign</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Permanently close this campaign on-chain. Participants will no longer be able to
                    submit proofs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEndModalOpen(true);
                    setEndStep("idle");
                    setEndError(null);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
                >
                  <StopCircle className="h-3.5 w-3.5" />
                  End campaign
                </button>
              </div>
            </DashboardPanel>
          ) : null}
          {canPublish ? (
            <DashboardPanel>
              <div className="space-y-3 p-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Publish winner payouts</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Campaign has ended. Consider waiting to give participants a window to reclaim
                    their join stake first — any amount forfeited for missed milestones grows the
                    pool winners split. Publishing locks in the pool at whatever it is right now.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPublishModalOpen(true);
                    setPublishStep("idle");
                    setPublishError(null);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-delulu-blue/30 bg-delulu-blue-light px-3 py-1.5 text-xs font-semibold text-delulu-blue hover:opacity-90 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Publish payouts
                </button>
              </div>
            </DashboardPanel>
          ) : null}
        </div>
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
            <DashboardStat label="Milestones" value={milestoneCount > 0 ? milestoneCount : "—"} />
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

          {/* Milestones panel — always visible */}
          <div className="mb-4">
            <DashboardPanel>
              {campaign.on_chain_challenge_id != null ? (
                <div>
                  {milestoneCount === 0 ? (
                    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <p className="font-semibold">No milestones on-chain yet</p>
                      <p className="mt-1 text-xs text-amber-800/90">
                        {isPlatformAdmin
                          ? "Add milestones on-chain so members can join and submit proof."
                          : "Milestones have not been published on-chain yet."}
                      </p>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Milestones</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {milestoneCount > 0 ? `${milestoneCount} live on-chain` : "No milestones on-chain yet."}
                      </p>
                    </div>
                    {isPlatformAdmin && (campaign.status === "approved" || campaign.status === "active") ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {milestoneCount === 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setMilestonesAutoGenerate(true);
                              setMilestonesModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-delulu-blue/30 bg-delulu-blue/8 px-3.5 py-2 text-xs font-semibold text-delulu-blue transition-colors hover:bg-delulu-blue/15"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Generate with AI
                          </button>
                        ) : null}
                        <DashboardPrimaryButton
                          type="button"
                          onClick={() => {
                            setMilestonesAutoGenerate(false);
                            setMilestonesModalOpen(true);
                          }}
                        >
                          {milestoneCount > 0 ? "Add more milestones" : "Add milestones manually"}
                        </DashboardPrimaryButton>
                      </div>
                    ) : null}
                  </div>
                  {milestones.length > 0 ? (
                    <ul className="divide-y divide-border border-t border-border px-4">
                      {milestones.map((m) => (
                        <li key={m.milestone_id} className="py-3 text-sm">
                          <p className="font-semibold text-foreground">{m.label}</p>
                          <p className="text-xs text-muted-foreground">
                            Due {new Date(m.deadline).toLocaleDateString()}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                // Draft / pending / rejected: no on-chain challenge yet
                <div className="p-4 space-y-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Milestones</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Milestones will be added on-chain by an admin after the campaign is approved and deployed.
                    </p>
                  </div>
                  {["draft", "rejected"].includes(campaign.status) ? (
                    <div>
                      {submitError ? (
                        <p className="mb-2 text-xs text-destructive">{submitError}</p>
                      ) : null}
                      <DashboardPrimaryButton
                        className="w-full"
                        disabled={submitPending}
                        onClick={() => void handleSubmitForApproval()}
                      >
                        {submitPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Submit for approval
                      </DashboardPrimaryButton>
                    </div>
                  ) : null}
                  {isPlatformAdmin &&
                  campaign.content_hash &&
                  campaign.on_chain_challenge_id == null &&
                  !["draft", "rejected"].includes(campaign.status) ? (
                    <div>
                      <p className="mb-2 text-xs text-amber-700">
                        Campaign content is prepared but it never finished deploying on-chain.
                      </p>
                      <DashboardPrimaryButton
                        className="w-full"
                        onClick={() => setDeployModalOpen(true)}
                      >
                        Deploy on-chain
                      </DashboardPrimaryButton>
                    </div>
                  ) : null}
                </div>
              )}
            </DashboardPanel>
          </div>

          <CampaignMilestonesModal
            key={milestonesAutoGenerate ? "ai" : "manual"}
            open={milestonesModalOpen}
            onOpenChange={(o) => {
              setMilestonesModalOpen(o);
              if (!o) setMilestonesAutoGenerate(false);
            }}
            campaignId={campaignId}
            challengeId={campaign.on_chain_challenge_id ?? 0}
            campaignTitle={campaign.title}
            durationDays={campaign.duration_days ?? 30}
            onChainMilestoneCount={milestoneCount}
            autoGenerate={milestonesAutoGenerate}
            onDone={() => {
              setMilestonesModalOpen(false);
              setMilestonesAutoGenerate(false);
              void refetch();
            }}
          />

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
                    <DashboardTableHeadCell>Participant</DashboardTableHeadCell>
                    <DashboardTableHeadCell align="right">Points</DashboardTableHeadCell>
                  </DashboardTableHeadRow>
                </DashboardTableHead>
                <DashboardTableBody>
                  {leaderboard.map((row, index) => (
                    <DashboardTableRow key={row.wallet_address}>
                      <DashboardTableCell>{index + 1}</DashboardTableCell>
                      <DashboardTableCell className="text-xs">
                        {formatLeaderboardDisplayName({
                          username: (row as { username?: string | null }).username,
                          walletAddress: row.wallet_address,
                          formatAddress,
                        })}
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

      <DeleteCampaignModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        campaignId={campaignId}
        title={campaign.title}
        onDeleted={() => router.push(`/dashboard/communities/${communityId}`)}
      />

      <ApproveCampaignModal
        open={deployModalOpen}
        onOpenChange={setDeployModalOpen}
        campaign={campaign}
        onSuccess={() => {
          setDeployModalOpen(false);
          void refetch();
        }}
      />
    </DashboardPage>
  );
}
