"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2, Plus, Sparkles, StopCircle, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLeaderboardDisplayName } from "@/lib/community/enrich-leaderboard-usernames";
import { canDeleteDashboardCampaign, canEndDashboardCampaign } from "@/lib/dashboard/campaign-constants";
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
import { useEndCommunityChallenge } from "@/hooks/use-community-campaign-onchain";
import { CampaignMilestonesModal } from "@/components/dashboard/campaign-milestones-modal";
import { DeleteCampaignModal } from "@/components/dashboard/delete-campaign-modal";
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
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [milestonesModalOpen, setMilestonesModalOpen] = useState(false);
  const [milestones, setMilestones] = useState<CommunityCampaignMilestoneRow[]>([]);
  const [milestoneCount, setMilestoneCount] = useState(0);

  // Draft milestone management (before campaign is on-chain)
  type DraftMilestone = { id: string; title: string; duration_days: number; order_index: number };
  const [draftMilestones, setDraftMilestones] = useState<DraftMilestone[]>([]);
  const [draftMilestonesLoading, setDraftMilestonesLoading] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDays, setNewMilestoneDays] = useState(7);
  const [draftSuggesting, setDraftSuggesting] = useState(false);
  const [draftMilestoneError, setDraftMilestoneError] = useState<string | null>(null);
  const [endStep, setEndStep] = useState<"idle" | "signing" | "confirming" | "done" | "error">("idle");
  const [endError, setEndError] = useState<string | null>(null);
  const [submitPending, setSubmitPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data, isLoading, refetch } = useDashboardCampaign(campaignId);
  const campaign = data?.campaign;
  const leaderboard = data?.leaderboard ?? [];
  const { endCommunityChallenge, isPending: isEndingOnChain } = useEndCommunityChallenge();

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
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to confirm end");
      }
      setEndStep("done");
      void refetch();
    } catch (err) {
      setEndStep("error");
      setEndError(err instanceof Error ? err.message : "Failed to end campaign");
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

  const loadDraftMilestones = useCallback(async () => {
    setDraftMilestonesLoading(true);
    try {
      const res = await fetch(`/api/dashboard/campaigns/${campaignId}/milestones`);
      if (!res.ok) return;
      const json = await res.json();
      setDraftMilestones(json.milestones ?? []);
    } finally {
      setDraftMilestonesLoading(false);
    }
  }, [campaignId]);

  const addDraftMilestone = async () => {
    if (!newMilestoneTitle.trim()) return;
    setDraftMilestoneError(null);
    try {
      const res = await fetch(`/api/dashboard/campaigns/${campaignId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newMilestoneTitle.trim(), duration_days: newMilestoneDays }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to add milestone");
      }
      setNewMilestoneTitle("");
      setNewMilestoneDays(7);
      await loadDraftMilestones();
    } catch (err) {
      setDraftMilestoneError(err instanceof Error ? err.message : "Failed");
    }
  };

  const removeDraftMilestone = async (milestoneId: string) => {
    setDraftMilestoneError(null);
    try {
      await fetch(`/api/dashboard/campaigns/${campaignId}/milestones/${milestoneId}`, {
        method: "DELETE",
      });
      await loadDraftMilestones();
    } catch {
      setDraftMilestoneError("Failed to remove milestone");
    }
  };

  const suggestDraftMilestones = async () => {
    if (!campaign) return;
    setDraftSuggesting(true);
    setDraftMilestoneError(null);
    try {
      const res = await fetch("/api/ai/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: campaign.title, durationDays: campaign.duration_days ?? 30 }),
      });
      const json = await res.json() as { milestones?: { title: string; days: number }[] };
      const suggestions = json.milestones ?? [];
      await Promise.all(
        suggestions.map((m) =>
          fetch(`/api/dashboard/campaigns/${campaignId}/milestones`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: m.title, duration_days: m.days }),
          }),
        ),
      );
      await loadDraftMilestones();
    } catch {
      setDraftMilestoneError("Couldn't generate suggestions. Add milestones manually.");
    } finally {
      setDraftSuggesting(false);
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

  useEffect(() => {
    if (campaign && campaign.on_chain_challenge_id == null) {
      void loadDraftMilestones();
    }
  }, [campaign, loadDraftMilestones]);

  useEffect(() => {
    if (campaign?.on_chain_challenge_id != null && milestoneCount === 0) {
      void loadDraftMilestones();
    }
  }, [campaign?.on_chain_challenge_id, loadDraftMilestones, milestoneCount]);

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
          ) : canEnd ? (
            <button
              type="button"
              onClick={() => { setEndModalOpen(true); setEndStep("idle"); setEndError(null); }}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
            >
              <StopCircle className="h-3.5 w-3.5" />
              End campaign
            </button>
          ) : null}
        </div>
        {campaign.description ? (
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{campaign.description}</p>
        ) : null}
      </div>

      <DashboardModal
        open={endModalOpen}
        onOpenChange={(o: boolean) => { if (!isEndingOnChain && endStep !== "confirming") setEndModalOpen(o); }}
        title="End campaign"
        description={`This will permanently close "${campaign.title}" on-chain. Participants will no longer be able to submit proofs.`}
      >
        <div className="space-y-4 pt-2 text-sm">
          {endStep === "done" ? (
            <p className="font-semibold text-emerald-700">Campaign ended successfully.</p>
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
                      <p className="font-semibold">Milestones not published yet</p>
                      <p className="mt-1 text-xs text-amber-800/90">
                        This campaign is on-chain but members cannot join until you publish milestones.
                        {draftMilestones.length > 0
                          ? ` ${draftMilestones.length} planned milestone${draftMilestones.length !== 1 ? "s" : ""} ready to publish.`
                          : " Add milestones in the draft first."}
                      </p>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Milestones</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {milestoneCount > 0
                          ? `${milestoneCount} live on-chain`
                          : draftMilestones.length > 0
                            ? `${draftMilestones.length} planned — not on-chain yet`
                            : "No milestones on-chain yet."}
                      </p>
                    </div>
                    {(campaign.status === "approved" || campaign.status === "active") ? (
                      <DashboardPrimaryButton
                        type="button"
                        disabled={milestoneCount === 0 && draftMilestones.length === 0}
                        onClick={() => setMilestonesModalOpen(true)}
                      >
                        {milestoneCount > 0 ? "Add more milestones" : "Publish milestones on-chain"}
                      </DashboardPrimaryButton>
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
                // Draft / pending / rejected: read from DB, allow add/remove
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Milestones</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {campaign.status === "pending_approval"
                          ? "Milestones locked — campaign is awaiting approval."
                          : draftMilestones.length > 0
                            ? `${draftMilestones.length} milestone${draftMilestones.length !== 1 ? "s" : ""} planned`
                            : "Add milestones before submitting for approval."}
                      </p>
                    </div>
                    {["draft", "rejected"].includes(campaign.status) ? (
                      <button
                        type="button"
                        disabled={draftSuggesting}
                        onClick={() => void suggestDraftMilestones()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 disabled:opacity-40"
                      >
                        {draftSuggesting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3 text-delulu-blue" />
                        )}
                        AI suggest
                      </button>
                    ) : null}
                  </div>

                  {draftMilestoneError ? (
                    <p className="px-4 pb-3 text-xs text-destructive">{draftMilestoneError}</p>
                  ) : null}

                  {draftMilestonesLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : draftMilestones.length > 0 ? (
                    <ul className="divide-y divide-border border-t border-border">
                      {draftMilestones.map((m, i) => (
                        <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                          <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">{m.title}</p>
                            <p className="text-xs text-muted-foreground">{m.duration_days}d</p>
                          </div>
                          {["draft", "rejected"].includes(campaign.status) ? (
                            <button
                              type="button"
                              onClick={() => void removeDraftMilestone(m.id)}
                              className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {["draft", "rejected"].includes(campaign.status) ? (
                    <div className="border-t border-border p-4 space-y-3">
                      <div className="flex gap-2">
                        <input
                          className={dashboardInputClass + " flex-1"}
                          value={newMilestoneTitle}
                          onChange={(e) => setNewMilestoneTitle(e.target.value)}
                          placeholder="Milestone title"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addDraftMilestone(); } }}
                        />
                        <select
                          className={dashboardInputClass + " w-16 shrink-0"}
                          value={newMilestoneDays}
                          onChange={(e) => setNewMilestoneDays(Number(e.target.value))}
                        >
                          {[1, 3, 7, 14, 30].map((d) => (
                            <option key={d} value={d}>{d}d</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!newMilestoneTitle.trim()}
                          onClick={() => void addDraftMilestone()}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-delulu-blue text-white hover:bg-delulu-blue/90 disabled:opacity-40"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      {draftMilestones.length > 0 ? (
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
                    </div>
                  ) : null}
                </div>
              )}
            </DashboardPanel>
          </div>

          <CampaignMilestonesModal
            open={milestonesModalOpen}
            onOpenChange={setMilestonesModalOpen}
            campaignId={campaignId}
            challengeId={campaign.on_chain_challenge_id ?? 0}
            campaignTitle={campaign.title}
            durationDays={campaign.duration_days ?? 30}
            onChainMilestoneCount={milestoneCount}
            onDone={() => {
              setMilestonesModalOpen(false);
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
    </DashboardPage>
  );
}
