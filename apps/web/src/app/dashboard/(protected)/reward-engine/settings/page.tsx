"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  DashboardField,
  DashboardModal,
  DashboardPage,
  DashboardPrimaryButton,
  DashboardTableCard,
  DashboardTableEmptyState,
  DashboardTableLoading,
  dashboardInputClass,
  useDashboardToast,
} from "@/components/dashboard/dashboard-ui";
import { DashboardSectionTabs, REWARD_ENGINE_SECTION_TABS } from "@/components/dashboard/dashboard-section-tabs";
import { adminFetch, configPathLabel, formatConfigValue, formatWhen } from "@/components/admin/reward-engine-ui";
import type { RewardEngineConfigDto } from "@/app/api/dashboard/reward-engine/config/route";
import { diffRewardsConfig, validateRewardsConfig, type ConfigChange, type ConfigIssue } from "@/lib/rewards/config-schema";
import type { CompletionTier, RewardsConfig } from "@/lib/rewards/rules";
import { cn } from "@/lib/utils";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (_v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-delulu-blue" : "bg-muted-foreground/30",
      )}
    >
      <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

function Section({
  title,
  description,
  enabled,
  onEnabled,
  children,
}: {
  title: string;
  description: string;
  enabled?: boolean;
  onEnabled?: (_v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {onEnabled ? <Toggle checked={!!enabled} onChange={onEnabled} label={`${title} on`} /> : null}
      </div>
      <div className={cn("grid gap-4 sm:grid-cols-2", enabled === false && "opacity-60")}>{children}</div>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  issue,
  hint,
  step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (_v: number) => void;
  issue?: string;
  hint?: string;
  step?: number;
  suffix?: string;
}) {
  return (
    <DashboardField label={label}>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          step={step ?? 1}
          className={cn(dashboardInputClass, suffix && "pr-12", issue && "border-red-300 ring-1 ring-red-200")}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
        />
        {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
      {issue ? <p className="mt-1 text-xs text-red-600">{issue}</p> : hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </DashboardField>
  );
}

function TiersEditor({
  tiers,
  onChange,
  issue,
}: {
  tiers: CompletionTier[];
  onChange: (_t: CompletionTier[]) => void;
  issue?: string;
}) {
  const sorted = tiers.map((t, i) => ({ ...t, i })).sort((a, b) => a.minDays - b.minDays || a.i - b.i);
  const set = (i: number, patch: Partial<CompletionTier>) => onChange(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className="sm:col-span-2">
      <p className="mb-1.5 text-xs font-semibold text-foreground">Tiers (by length)</p>
      <div className="space-y-2">
        {sorted.map((t) => (
          <div key={t.i} className="flex items-center gap-2">
            <div className="relative w-36">
              <input
                type="number"
                className={cn(dashboardInputClass, "pr-14")}
                value={Number.isFinite(t.minDays) ? t.minDays : ""}
                onChange={(e) => set(t.i, { minDays: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
                aria-label="Minimum days"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">days+</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="relative w-40">
              <input
                type="number"
                className={cn(dashboardInputClass, "pr-10")}
                value={Number.isFinite(t.amount) ? t.amount : ""}
                onChange={(e) => set(t.i, { amount: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
                aria-label="Amount"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">G$</span>
            </div>
            <button
              type="button"
              onClick={() => onChange(tiers.filter((_, j) => j !== t.i))}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-red-600"
              aria-label="Remove tier"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {tiers.length === 0 ? <p className="text-xs text-muted-foreground">No tiers — this bonus pays nothing.</p> : null}
        {tiers.length < 6 ? (
          <button
            type="button"
            onClick={() => onChange([...tiers, { minDays: Number.NaN, amount: Number.NaN }])}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-delulu-blue hover:bg-delulu-blue-light"
          >
            <Plus className="h-3.5 w-3.5" /> Add tier
          </button>
        ) : null}
      </div>
      {issue ? <p className="mt-1 text-xs text-red-600">{issue}</p> : null}
    </div>
  );
}

/** Changes worth a second look in the confirm step. */
function riskNote(c: ConfigChange): string | null {
  if (c.after === false && /enabled$/.test(c.path)) return "Stops new rewards";
  if (typeof c.before === "number" && typeof c.after === "number" && c.before > 0 && c.after >= c.before * 2) {
    return `${(c.after / c.before).toFixed(1)}× increase`;
  }
  if (c.path === "limits.dailyBudget" && c.after !== 0 && (c.before === 0 || (c.after as number) < (c.before as number))) {
    return "Rewards over the budget wait until the next day";
  }
  return null;
}

export default function RewardEngineSettingsPage() {
  const { show: toast } = useDashboardToast();
  const [saved, setSaved] = useState<RewardEngineConfigDto | null>(null);
  const [draft, setDraft] = useState<RewardsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await adminFetch<RewardEngineConfigDto>("/api/dashboard/reward-engine/config");
      setSaved(res);
      setDraft(clone(res.config));
      setConflict(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const validation = useMemo(() => (draft ? validateRewardsConfig(draft) : null), [draft]);
  const issues: ConfigIssue[] = validation && !validation.ok ? validation.issues : [];
  const issueAt = (path: string) => issues.find((i) => i.path === path || i.path.startsWith(`${path}.`))?.message;
  const changes = useMemo(
    () => (saved && validation?.ok ? diffRewardsConfig(saved.config, validation.config) : []),
    [saved, validation],
  );

  if (loading && !draft) {
    return (
      <DashboardPage className="max-w-none px-5 sm:px-7">
        <DashboardSectionTabs items={REWARD_ENGINE_SECTION_TABS} />
        <DashboardTableCard>
          <DashboardTableLoading />
        </DashboardTableCard>
      </DashboardPage>
    );
  }
  if (loadError || !draft || !saved) {
    return (
      <DashboardPage className="max-w-none px-5 sm:px-7">
        <DashboardSectionTabs items={REWARD_ENGINE_SECTION_TABS} />
        <DashboardTableCard>
          <DashboardTableEmptyState title="Couldn’t load reward settings" description={loadError ?? ""} />
        </DashboardTableCard>
      </DashboardPage>
    );
  }

  const update = (fn: (_c: RewardsConfig) => void) => {
    const next = clone(draft);
    fn(next);
    setDraft(next);
  };

  async function save() {
    if (!validation?.ok) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await adminFetch<RewardEngineConfigDto & { changes: ConfigChange[] }>("/api/dashboard/reward-engine/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: validation.config, expectedUpdatedAt: saved?.updatedAt ?? null, reason }),
      });
      setSaved(res);
      setDraft(clone(res.config));
      setConfirmOpen(false);
      setReason("");
      toast(`Saved ${res.changes.length} change${res.changes.length === 1 ? "" : "s"}`);
    } catch (err) {
      const e = err as Error & { status?: number; body?: { issues?: ConfigIssue[] } };
      setConflict(e.status === 409);
      setSaveError(
        e.body?.issues?.length ? e.body.issues.map((i) => `${configPathLabel(i.path)}: ${i.message}`).join(" · ") : e.message,
      );
    } finally {
      setSaving(false);
    }
  }

  const largest = Math.max(
    draft.dailyProof.amount || 0,
    draft.weeklyConsistency.amount || 0,
    ...draft.campaignCompletion.tiers.map((t) => t.amount || 0),
    ...draft.goalCompletion.tiers.map((t) => t.amount || 0),
  );

  return (
    <DashboardPage className="max-w-none px-5 pb-28 sm:px-7">
      <DashboardSectionTabs items={REWARD_ENGINE_SECTION_TABS} />
      <p className="mb-5 text-sm text-muted-foreground">
        Enforced by the backend for every new reward; rewards already granted keep their amount and still pay. Changes
        reach every server within a minute.
        {saved.updatedAt ? (
          <>
            {" "}
            Last saved {formatWhen(saved.updatedAt)}
            {saved.updatedBy ? ` by ${saved.updatedBy}` : ""}.
          </>
        ) : (
          " Running on the default settings."
        )}
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          title="Rewards engine"
          description="Master switch. Off grants nothing new in any category."
          enabled={draft.enabled}
          onEnabled={(v) => update((c) => void (c.enabled = v))}
        >
          <DashboardField label="Reward calendar timezone">
            <input
              className={cn(dashboardInputClass, issueAt("timezone") && "border-red-300")}
              value={draft.timezone}
              onChange={(e) => update((c) => void (c.timezone = e.target.value))}
            />
            {issueAt("timezone") ? (
              <p className="mt-1 text-xs text-red-600">{issueAt("timezone")}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Sets when “today” and “this week” roll over.</p>
            )}
          </DashboardField>
          <NumberField
            label="Platform daily budget"
            suffix="G$"
            value={draft.limits.dailyBudget}
            onChange={(v) => update((c) => void (c.limits.dailyBudget = v))}
            issue={issueAt("limits.dailyBudget")}
            hint={`Max G$ sent per UTC day across all users. 0 = no limit. Must be ≥ ${largest.toLocaleString()} (largest reward).`}
          />
        </Section>

        <Section
          title="Daily proof"
          description="Paid per approved proof, one per goal per day."
          enabled={draft.dailyProof.enabled}
          onEnabled={(v) => update((c) => void (c.dailyProof.enabled = v))}
        >
          <NumberField
            label="Amount"
            suffix="G$"
            value={draft.dailyProof.amount}
            onChange={(v) => update((c) => void (c.dailyProof.amount = v))}
            issue={issueAt("dailyProof.amount")}
          />
          <NumberField
            label="Daily limit (goals per user)"
            value={draft.dailyProof.maxEligibleGoals}
            onChange={(v) => update((c) => void (c.dailyProof.maxEligibleGoals = v))}
            issue={issueAt("dailyProof.maxEligibleGoals")}
            hint="Max daily proof rewards per user per day."
          />
          <NumberField
            label="Abandoned-goal cooldown"
            suffix="days"
            value={draft.dailyProof.abandonCooldownDays}
            onChange={(v) => update((c) => void (c.dailyProof.abandonCooldownDays = v))}
            issue={issueAt("dailyProof.abandonCooldownDays")}
          />
          <NumberField
            label="Release idle goal after"
            suffix="days"
            value={draft.dailyProof.idleReleaseDays}
            onChange={(v) => update((c) => void (c.dailyProof.idleReleaseDays = v))}
            issue={issueAt("dailyProof.idleReleaseDays")}
          />
        </Section>

        <Section
          title="Weekly consistency"
          description="Once per user per Mon–Sun week."
          enabled={draft.weeklyConsistency.enabled}
          onEnabled={(v) => update((c) => void (c.weeklyConsistency.enabled = v))}
        >
          <NumberField
            label="Amount"
            suffix="G$"
            value={draft.weeklyConsistency.amount}
            onChange={(v) => update((c) => void (c.weeklyConsistency.amount = v))}
            issue={issueAt("weeklyConsistency.amount")}
          />
          <NumberField
            label="Weekly limit (proofs needed)"
            value={draft.weeklyConsistency.minProofs}
            onChange={(v) => update((c) => void (c.weeklyConsistency.minProofs = v))}
            issue={issueAt("weeklyConsistency.minProofs")}
            hint="Daily-rewarded proofs needed in one week."
          />
        </Section>

        <Section
          title="Campaign completion"
          description="Once per campaign, by its length. Late joiners get tier × share^curve."
          enabled={draft.campaignCompletion.enabled}
          onEnabled={(v) => update((c) => void (c.campaignCompletion.enabled = v))}
        >
          <TiersEditor
            tiers={draft.campaignCompletion.tiers}
            onChange={(t) => update((c) => void (c.campaignCompletion.tiers = t))}
            issue={issueAt("campaignCompletion.tiers")}
          />
          <NumberField
            label="Late-join curve"
            step={0.5}
            value={draft.campaignCompletion.lateJoinExponent}
            onChange={(v) => update((c) => void (c.campaignCompletion.lateJoinExponent = v))}
            issue={issueAt("campaignCompletion.lateJoinExponent")}
            hint="1 = proportional, 2 = joining halfway earns 25%."
          />
        </Section>

        <Section
          title="Goal completion"
          description="Forfeit goals, by length × share of days in an earning slot."
          enabled={draft.goalCompletion.enabled}
          onEnabled={(v) => update((c) => void (c.goalCompletion.enabled = v))}
        >
          <TiersEditor
            tiers={draft.goalCompletion.tiers}
            onChange={(t) => update((c) => void (c.goalCompletion.tiers = t))}
            issue={issueAt("goalCompletion.tiers")}
          />
          <NumberField
            label="Slot-share curve"
            step={0.5}
            value={draft.goalCompletion.shareExponent}
            onChange={(v) => update((c) => void (c.goalCompletion.shareExponent = v))}
            issue={issueAt("goalCompletion.shareExponent")}
          />
        </Section>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-5 py-3 backdrop-blur lg:left-[212px]">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="mr-auto text-sm text-muted-foreground">
            {issues.length > 0
              ? `${issues.length} issue${issues.length === 1 ? "" : "s"} to fix`
              : changes.length > 0
                ? `${changes.length} unsaved change${changes.length === 1 ? "" : "s"}`
                : "No changes"}
          </span>
          <button
            type="button"
            onClick={() => setDraft(clone(saved.defaults))}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Defaults
          </button>
          <button
            type="button"
            disabled={changes.length === 0 && issues.length === 0}
            onClick={() => setDraft(clone(saved.config))}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Discard
          </button>
          <DashboardPrimaryButton
            disabled={issues.length > 0 || changes.length === 0}
            onClick={() => {
              setSaveError(null);
              setConfirmOpen(true);
            }}
          >
            Review & save
          </DashboardPrimaryButton>
        </div>
      </div>

      <DashboardModal
        open={confirmOpen}
        onOpenChange={(open) => !saving && setConfirmOpen(open)}
        title="Confirm reward settings"
        description="Applies to every new reward. This change and your reason are recorded in the audit log."
      >
        <div className="space-y-4">
          <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <tbody>
                {changes.map((c) => {
                  const note = riskNote(c);
                  return (
                    <tr key={c.path} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium text-foreground">{configPathLabel(c.path)}</td>
                      <td className="px-3 py-2 text-muted-foreground line-through">{formatConfigValue(c.before)}</td>
                      <td className="px-3 py-2 font-semibold text-foreground">
                        {formatConfigValue(c.after)}
                        {note ? (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            <AlertTriangle className="h-3 w-3" />
                            {note}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DashboardField label="Reason for this change" required>
            <textarea
              className={cn(dashboardInputClass, "min-h-[72px]")}
              placeholder="e.g. Raising daily proof reward for the November push"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </DashboardField>
          {saveError ? (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
              {conflict ? (
                <button type="button" onClick={() => void load().then(() => setConfirmOpen(false))} className="ml-2 font-semibold underline">
                  Reload settings
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <DashboardPrimaryButton disabled={saving || reason.trim().length < 5} onClick={() => void save()}>
              {saving ? "Saving…" : "Confirm & save"}
            </DashboardPrimaryButton>
          </div>
        </div>
      </DashboardModal>
    </DashboardPage>
  );
}
