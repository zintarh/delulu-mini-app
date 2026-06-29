"use client";

import { FormEvent, useState } from "react";
import { Loader2, Plus, Sparkles, X } from "lucide-react";
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

type MilestoneInput = { title: string; duration_days: number };
const MILESTONE_DURATIONS = [1, 3, 7, 14, 30] as const;
const FORFEIT_OPTIONS = [0, 2, 5, 10] as const;

async function suggestMilestones(title: string, durationDays: number): Promise<MilestoneInput[]> {
  const res = await fetch("/api/ai/milestones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal: title, durationDays }),
  });
  if (!res.ok) throw new Error("Suggestion failed");
  const json = (await res.json()) as { milestones?: { title: string; days: number }[] };
  return (json.milestones ?? []).map((m) => ({ title: m.title, duration_days: m.days }));
}

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

  // Basic fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [proofInstructions, setProofInstructions] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [durationDays, setDurationDays] = useState<CampaignDurationDays>(30);
  const [prizeWinnerCount, setPrizeWinnerCount] = useState<PrizeWinnerCount>(10);

  // Telegram
  const [telegramLink, setTelegramLink] = useState("");

  // Economics
  const [isFree, setIsFree] = useState(true);
  const [joinToken, setJoinToken] = useState<"G$" | "USDT">("G$");
  const [joinAmount, setJoinAmount] = useState("");
  const [forfeitPct, setForfeitPct] = useState<0 | 2 | 5 | 10>(0);

  // Milestones
  const [milestones, setMilestones] = useState<MilestoneInput[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle(""); setDescription(""); setCoverImageUrl(null); setProofInstructions("");
    setCadence("daily"); setDurationDays(30); setPrizeWinnerCount(10);
    setIsFree(true); setJoinToken("G$"); setJoinAmount(""); setForfeitPct(0);
    setTelegramLink("");
    setMilestones([]); setSuggestError(null); setError(null);
  };

  const addMilestone = () =>
    setMilestones((prev) => [...prev, { title: "", duration_days: 7 }]);

  const removeMilestone = (i: number) =>
    setMilestones((prev) => prev.filter((_, idx) => idx !== i));

  const updateMilestone = (i: number, patch: Partial<MilestoneInput>) =>
    setMilestones((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  const handleSuggest = async () => {
    if (!title.trim()) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const suggestions = await suggestMilestones(title.trim(), durationDays);
      setMilestones(suggestions);
    } catch {
      setSuggestError("Couldn't generate suggestions. Try again.");
    } finally {
      setSuggesting(false);
    }
  };

  const submit = async (e: FormEvent, forApproval: boolean) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (forApproval && milestones.length === 0) {
      setError("Add at least one milestone before submitting for approval.");
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        proofCadence: cadence,
        proofInstructions: proofInstructions.trim(),
        durationDays,
        prizeWinnerCount,
        coverImageUrl,
        submit: forApproval,
        isFreeToJoin: isFree,
        joinToken: isFree ? undefined : joinToken,
        joinAmount: isFree ? undefined : parseFloat(joinAmount) || 0,
        forfeitPct: isFree ? 0 : forfeitPct,
        telegramLink: telegramLink.trim() || undefined,
        milestones: milestones
          .filter((m) => m.title.trim())
          .map((m, i) => ({ title: m.title.trim(), duration_days: m.duration_days, order_index: i })),
      });
      window.dispatchEvent(new Event("delulu:campaign-created"));
      onSuccess?.({ submitted: forApproval });
      onOpenChange(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const canSubmitForApproval = title.trim().length > 0 && milestones.filter((m) => m.title.trim()).length > 0;

  return (
    <DashboardModal
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="Create campaign"
      className="max-w-3xl p-6 sm:p-8 max-h-[90vh] overflow-hidden flex flex-col"
    >
      <form className="space-y-5 pt-2 overflow-y-auto flex-1 pr-1" onSubmit={(e) => submit(e, true)}>
        {/* Basic info */}
        <DashboardField label="Title" required>
          <input
            className={dashboardInputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Walk 10,000 steps daily"
            required
          />
        </DashboardField>

        <DashboardField label="Description">
          <textarea
            rows={3}
            className={cn(dashboardInputClass, "resize-none")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what participants need to do and why this campaign matters."
          />
        </DashboardField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DashboardField label="Cover image">
            <CampaignCoverUpload value={coverImageUrl} onChange={setCoverImageUrl} compact />
          </DashboardField>

          <div className="flex flex-col gap-4">
            <DashboardField label="Duration" required>
              <DashboardSelect
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value) as CampaignDurationDays)}
              >
                {CAMPAIGN_DURATION_OPTIONS.map((days) => (
                  <option key={days} value={days}>{days} days</option>
                ))}
              </DashboardSelect>
            </DashboardField>

            <DashboardField label="Prize split" required>
              <DashboardSelect
                value={prizeWinnerCount}
                onChange={(e) => setPrizeWinnerCount(Number(e.target.value) as PrizeWinnerCount)}
              >
                {PRIZE_WINNER_COUNTS.map((n) => (
                  <option key={n} value={n}>Top {n}</option>
                ))}
              </DashboardSelect>
            </DashboardField>
          </div>
        </div>

        <DashboardField label="Proof instructions">
          <textarea
            rows={2}
            className={cn(dashboardInputClass, "resize-none")}
            value={proofInstructions}
            onChange={(e) => setProofInstructions(e.target.value)}
            placeholder="Upload a screenshot of your step count or fitness app."
          />
        </DashboardField>

        <DashboardField label="Telegram group link (optional)">
          <input
            type="url"
            className={dashboardInputClass}
            value={telegramLink}
            onChange={(e) => setTelegramLink(e.target.value)}
            placeholder="https://t.me/yourcommunity"
          />
        </DashboardField>

        {/* Economics */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Joining & rewards
          </p>

          <div className="flex gap-2">
            {(["free", "paid"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setIsFree(type === "free")}
                className={cn(
                  "flex-1 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                  (isFree ? type === "free" : type === "paid")
                    ? "border-delulu-blue bg-delulu-blue text-white"
                    : "border-border bg-background text-foreground hover:bg-muted/50",
                )}
              >
                {type === "free" ? "Free to join" : "Paid (stake required)"}
              </button>
            ))}
          </div>

          {!isFree && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="w-24 shrink-0">
                  <DashboardField label="Token">
                    <DashboardSelect
                      value={joinToken}
                      onChange={(e) => setJoinToken(e.target.value as "G$" | "USDT")}
                    >
                      <option value="G$">G$</option>
                      <option value="USDT">USDT</option>
                    </DashboardSelect>
                  </DashboardField>
                </div>
                <div className="flex-1">
                  <DashboardField label="Stake amount">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className={dashboardInputClass}
                      value={joinAmount}
                      onChange={(e) => setJoinAmount(e.target.value)}
                      placeholder="10"
                    />
                  </DashboardField>
                </div>
              </div>

              <DashboardField label="Forfeit % per missed milestone">
                <div className="flex gap-2">
                  {FORFEIT_OPTIONS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setForfeitPct(pct)}
                      className={cn(
                        "flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors",
                        forfeitPct === pct
                          ? "border-delulu-blue bg-delulu-blue text-white"
                          : "border-border bg-background text-foreground hover:bg-muted/50",
                      )}
                    >
                      {pct === 0 ? "None" : `${pct}%`}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Forfeited stakes go into a second pool shared with winners.
                </p>
              </DashboardField>
            </div>
          )}
        </div>

        {/* Milestones */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Milestones
              </p>
              <p className="text-[11px] text-muted-foreground">
                At least 1 required to submit for approval
              </p>
            </div>
            <button
              type="button"
              disabled={!title.trim() || suggesting}
              onClick={() => void handleSuggest()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/50 disabled:opacity-40 transition-colors"
            >
              {suggesting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 text-delulu-blue" />
              )}
              AI suggest
            </button>
          </div>

          {suggestError ? (
            <p className="text-[11px] text-destructive">{suggestError}</p>
          ) : null}

          <div className="space-y-2">
            {milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="shrink-0 w-5 text-center text-xs font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <input
                  className={cn(dashboardInputClass, "flex-1")}
                  value={m.title}
                  onChange={(e) => updateMilestone(i, { title: e.target.value })}
                  placeholder={`Milestone ${i + 1}`}
                />
                <select
                  className={cn(dashboardInputClass, "w-24 shrink-0")}
                  value={m.duration_days}
                  onChange={(e) => updateMilestone(i, { duration_days: Number(e.target.value) })}
                >
                  {MILESTONE_DURATIONS.map((d) => (
                    <option key={d} value={d}>{d}d</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeMilestone(i)}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addMilestone}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-delulu-blue hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Add milestone
          </button>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="flex flex-wrap-reverse gap-2 border-t border-border/40 pt-3">
          <button
            type="button"
            disabled={create.isPending}
            onClick={(e) => { e.preventDefault(); void submit(e, false); }}
            className="inline-flex items-center justify-center rounded-xl border border-[#e8e8e3] bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
          >
            Save draft
          </button>
          <DashboardPrimaryButton
            type="submit"
            disabled={create.isPending || !canSubmitForApproval}
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit for approval
          </DashboardPrimaryButton>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Drafts are only visible to you. Submit when your campaign is ready to go live.
        </p>
      </form>
    </DashboardModal>
  );
}
