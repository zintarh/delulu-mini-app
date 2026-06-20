"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CAMPAIGN_DURATION_OPTIONS,
  PRIZE_WINNER_COUNTS,
  type CampaignDurationDays,
  type PrizeWinnerCount,
} from "@/lib/community/campaign-types";
import { CampaignCoverUpload } from "@/components/dashboard/campaign-cover-upload";
import {
  DashboardModal,
  DashboardField,
  DashboardPrimaryButton,
  DashboardSelect,
  dashboardInputClass,
} from "@/components/dashboard/dashboard-ui";
import { useCreateCampaign } from "@/hooks/dashboard/use-dashboard-campaigns";

export function CreateCampaignModal({
  open,
  onOpenChange,
  communityId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  onSuccess?: (result: { submitted: boolean }) => void;
}) {
  const create = useCreateCampaign(communityId);
  const [title, setTitle] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [proofInstructions, setProofInstructions] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [durationDays, setDurationDays] = useState<CampaignDurationDays>(30);
  const [prizeWinnerCount, setPrizeWinnerCount] = useState<PrizeWinnerCount>(10);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setCoverImageUrl(null);
    setProofInstructions("");
    setCadence("daily");
    setDurationDays(30);
    setPrizeWinnerCount(10);
    setError(null);
  };

  const submit = async (e: FormEvent, forApproval: boolean) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    try {
      await create.mutateAsync({
        title: title.trim(),
        proofCadence: cadence,
        proofInstructions: proofInstructions.trim(),
        durationDays,
        prizeWinnerCount,
        coverImageUrl,
        submit: forApproval,
      });
      onSuccess?.({ submitted: forApproval });
      onOpenChange(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <DashboardModal
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="Create campaign"
      className="max-w-3xl p-6 sm:p-8"
    >
      <form className="space-y-4 pt-2" onSubmit={(e) => submit(e, true)}>
        <DashboardField label="Title" required>
          <input
            className={dashboardInputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Walk 10,000 steps daily"
            required
          />
        </DashboardField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DashboardField label="Cover image">
            <CampaignCoverUpload
              value={coverImageUrl}
              onChange={setCoverImageUrl}
              compact
            />
          </DashboardField>

          <div className="flex flex-col gap-4">
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
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Pool shared among top {prizeWinnerCount} on the leaderboard at campaign end.
        </p>

        <DashboardField label="Proof instructions">
          <textarea
            rows={2}
            className={cn(dashboardInputClass, "resize-none")}
            value={proofInstructions}
            onChange={(e) => setProofInstructions(e.target.value)}
            placeholder="Upload a screenshot of your step count or fitness app."
          />
        </DashboardField>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <DashboardPrimaryButton
            type="button"
            className="bg-white text-foreground border border-[#e8e8e3] hover:bg-muted/40"
            disabled={create.isPending}
            onClick={(e) => {
              e.preventDefault();
              void submit(e, false);
            }}
          >
            Save draft
          </DashboardPrimaryButton>
          <DashboardPrimaryButton type="submit" disabled={create.isPending || !title.trim()}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit for approval
          </DashboardPrimaryButton>
        </div>
      </form>
    </DashboardModal>
  );
}
