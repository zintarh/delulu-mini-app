"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Ban, Copy, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import {
  DashboardField,
  DashboardIconButton,
  DashboardPage,
  DashboardPrimaryButton,
  DashboardStat,
  DashboardStatGrid,
  DashboardTableBody,
  DashboardTableCard,
  DashboardTableCell,
  DashboardTableEmptyState,
  DashboardTableHead,
  DashboardTableHeadCell,
  DashboardTableHeadRow,
  DashboardTableRow,
  DashboardTableScroll,
  StatusChip,
  dashboardInputClass,
  useDashboardToast,
} from "@/components/dashboard/dashboard-ui";
import { DashboardSectionTabs, REWARD_ENGINE_SECTION_TABS } from "@/components/dashboard/dashboard-section-tabs";
import { adminFetch, formatWhen } from "@/components/admin/reward-engine-ui";
import type { FaucetOverviewDto } from "@/app/api/dashboard/faucet/route";
import { faucetConfigIssues, type FaucetConfig, type FaucetStage, type StageConfig } from "@/lib/faucet/rules";
import { cn } from "@/lib/utils";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const fmtCelo = (n: number | null | undefined, digits = 4) =>
  n == null || !Number.isFinite(n) ? "—" : `${n.toLocaleString(undefined, { maximumFractionDigits: digits })} CELO`;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const STAGE_LABEL: Record<FaucetStage | "legacy", string> = {
  signup: "Signup",
  starter: "Starter",
  active: "Active",
  legacy: "Old faucet",
};

const REASON_LABEL: Record<string, string> = {
  blocked: "Blocklisted",
  captcha_failed: "Captcha failed",
  captcha_required: "No captcha",
  not_eligible: "Not eligible",
  stage_cap: "Step limit used up",
  ip_limit: "Too many on one IP",
  subnet_limit: "Too many on one network",
  daily_budget: "Daily budget hit",
  faucet_empty: "Faucet low",
  gas_too_high: "Gas too high",
  stale_pending: "Request died",
  dropped: "Tx dropped",
  reverted: "Tx reverted",
};

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <h3 className="mb-4 text-sm font-bold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (_v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", checked ? "bg-delulu-blue" : "bg-muted-foreground/30")}
    >
      <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

function Num({
  label,
  value,
  onChange,
  step,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (_v: number) => void;
  step?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <DashboardField label={label}>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          step={step ?? 1}
          className={cn(dashboardInputClass, suffix && "pr-16")}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
        />
        {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </DashboardField>
  );
}

function StageFields({
  stage,
  value,
  onChange,
  nowCelo,
}: {
  stage: FaucetStage;
  value: StageConfig;
  onChange: (_v: StageConfig) => void;
  nowCelo: number | null;
}) {
  return (
    <>
      <Num
        label={`${STAGE_LABEL[stage]} · gas units`}
        value={value.gasUnits}
        onChange={(v) => onChange({ ...value, gasUnits: v })}
        step={50_000}
        hint={nowCelo != null ? `≈ ${fmtCelo(nowCelo)} at today's fees` : undefined}
      />
      <Num label="Most per drip" value={value.maxPerDripCelo} onChange={(v) => onChange({ ...value, maxPerDripCelo: v })} step={0.01} suffix="CELO" />
      <Num
        label={stage === "active" ? "Total per window" : "Total per wallet"}
        value={value.capCelo}
        onChange={(v) => onChange({ ...value, capCelo: v })}
        step={0.01}
        suffix="CELO"
      />
    </>
  );
}

/**
 * Gas sponsor — admin view. Funding, live cost per drip, abuse signals, the
 * blocklist and every limit, all editable without a deploy.
 */
export default function FaucetAdminPage() {
  const { show: toast } = useDashboardToast();
  const [data, setData] = useState<FaucetOverviewDto | null>(null);
  const [draft, setDraft] = useState<FaucetConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [block, setBlock] = useState({ kind: "subnet", value: "", reason: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await adminFetch<FaucetOverviewDto>("/api/dashboard/faucet");
      setData(d);
      setDraft(clone(d.config));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = data && draft ? JSON.stringify(data.config) !== JSON.stringify(draft) : false;
  const issues = draft ? faucetConfigIssues(draft) : [];
  const update = (fn: (_c: FaucetConfig) => void) =>
    setDraft((d) => {
      if (!d) return d;
      const next = clone(d);
      fn(next);
      return next;
    });

  const save = async () => {
    if (!draft || !data) return;
    setSaving(true);
    try {
      await adminFetch("/api/dashboard/faucet", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: draft, expectedUpdatedAt: data.updatedAt, reason }),
      });
      toast("Gas settings saved");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addBlock = async (entry: { kind: string; value: string; reason?: string }) => {
    try {
      await adminFetch("/api/dashboard/faucet/blocklist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(entry),
      });
      setBlock({ kind: "subnet", value: "", reason: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't block");
    }
  };

  const removeBlock = async (id: string) => {
    try {
      await adminFetch(`/api/dashboard/faucet/blocklist?id=${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove");
    }
  };

  const lowBalance = data?.faucet.balanceCelo != null && data.faucet.balanceCelo < (draft?.limits.minReserveCelo ?? 0) + 0.5;
  const rejected = Object.entries(data?.last24h.rejected ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <DashboardPage className="max-w-none px-5 pb-28 sm:px-7">
      <DashboardSectionTabs items={REWARD_ENGINE_SECTION_TABS} />

      <div className="mb-5 mt-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Gas sponsor</h2>
          <p className="text-sm text-muted-foreground">Gas for people who skip the face check, in small drips tied to progress.</p>
        </div>
        <DashboardIconButton onClick={() => void load()} aria-label="Refresh">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </DashboardIconButton>
      </div>

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      ) : null}
      {data && !data.captchaConfigured ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Captcha is off: set TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY to stop scripted signups.
        </div>
      ) : null}
      {data && draft && !draft.enabled ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Gas sponsor is paused — nobody gets gas without the face check.
        </div>
      ) : null}

      <DashboardStatGrid>
        <DashboardStat label="Faucet balance" value={fmtCelo(data?.faucet.balanceCelo, 3)} isLoading={loading && !data} />
        <DashboardStat
          label="Spent · 24h"
          value={data ? `${fmtCelo(data.last24h.spentCelo, 3)} / ${data.config.limits.dailyBudgetCelo}` : "—"}
          isLoading={loading && !data}
        />
        <DashboardStat label="Runway" value={data?.runwayDays != null ? `${data.runwayDays} days` : "—"} isLoading={loading && !data} />
        <DashboardStat
          label="Signup → profile · 7d"
          value={data ? (data.conversion7d.funded ? `${Math.round((data.conversion7d.madeProfile / data.conversion7d.funded) * 100)}% of ${data.conversion7d.funded}` : "—") : "—"}
          isLoading={loading && !data}
        />
      </DashboardStatGrid>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title="Fund the faucet">
          {data?.faucet.address ? (
            <>
              <p className="mb-2 text-xs text-muted-foreground">Send CELO on Celo mainnet to:</p>
              <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 font-mono text-xs">
                <span className="min-w-0 flex-1 truncate">{data.faucet.address}</span>
                <button type="button" aria-label="Copy address" onClick={() => void navigator.clipboard.writeText(data.faucet.address!)}>
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <a href={`https://celoscan.io/address/${data.faucet.address}`} target="_blank" rel="noreferrer" aria-label="Open in explorer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              {lowBalance ? <p className="mt-2 text-xs font-semibold text-red-600">Running low — top it up.</p> : null}
            </>
          ) : (
            <p className="text-sm text-red-600">CELO_FAUCET_PRIVATE_KEY isn&apos;t set on the server.</p>
          )}
        </Panel>

        <Panel title="Live cost per drip">
          <Line label="Network max fee" value={data?.gas.maxFeeGwei != null ? `${data.gas.maxFeeGwei.toFixed(1)} gwei` : "—"} />
          {(["signup", "starter", "active"] as const).map((s) => (
            <Line key={s} label={`${STAGE_LABEL[s]} (empty wallet)`} value={fmtCelo(data?.gas.dripCelo?.[s] ?? null)} />
          ))}
          <p className="mt-2 text-xs text-muted-foreground">Drips above “most per drip” are refused until fees fall.</p>
        </Panel>

        <Panel title="Refused · 24h">
          {rejected.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing refused.</p>
          ) : (
            rejected.map(([k, n]) => <Line key={k} label={REASON_LABEL[k] ?? k} value={n} />)
          )}
        </Panel>
      </div>

      {draft ? (
        <Panel title="Settings" className="mt-5">
          <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            <label className="flex items-center gap-3 text-sm font-semibold">
              <Toggle checked={draft.enabled} onChange={(v) => update((c) => void (c.enabled = v))} label="Gas sponsor on" /> Sponsor on
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold">
              <Toggle checked={draft.requireCaptcha} onChange={(v) => update((c) => void (c.requireCaptcha = v))} label="Captcha at signup" /> Captcha at signup
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["signup", "starter", "active"] as const).map((s) => (
              <StageFields
                key={s}
                stage={s}
                value={draft.stages[s]}
                nowCelo={data?.gas.maxFeeGwei != null ? ((draft.stages[s].gasUnits * data.gas.maxFeeGwei * draft.gasMargin) / 1e9) : null}
                onChange={(v) => update((c) => void Object.assign(c.stages[s], v))}
              />
            ))}
            <Num label="Active · window" value={draft.stages.active.windowDays} onChange={(v) => update((c) => void (c.stages.active.windowDays = v))} suffix="days" />
            <Num
              label="Active · approved proofs needed"
              value={draft.stages.active.minProofs}
              onChange={(v) => update((c) => void (c.stages.active.minProofs = v))}
            />
            <Num
              label="…within"
              value={draft.stages.active.proofWindowDays}
              onChange={(v) => update((c) => void (c.stages.active.proofWindowDays = v))}
              suffix="days"
            />
            <Num label="Safety margin" value={draft.gasMargin} onChange={(v) => update((c) => void (c.gasMargin = v))} step={0.1} suffix="×" hint="× live gas cost" />
            <Num label="Daily budget" value={draft.limits.dailyBudgetCelo} onChange={(v) => update((c) => void (c.limits.dailyBudgetCelo = v))} step={0.5} suffix="CELO" hint="For face-verified accounts per day" />
            <Num label="Daily budget · not verified" value={draft.limits.unverifiedDailyBudgetCelo} onChange={(v) => update((c) => void (c.limits.unverifiedDailyBudgetCelo = v))} step={0.5} suffix="CELO" hint="One claim per wallet per day, captcha + per-IP limits" />
            <Num label="Keep in reserve" value={draft.limits.minReserveCelo} onChange={(v) => update((c) => void (c.limits.minReserveCelo = v))} step={0.1} suffix="CELO" />
            <Num label="Signups per IP · 24h" value={draft.limits.signupsPerIpPerDay} onChange={(v) => update((c) => void (c.limits.signupsPerIpPerDay = v))} />
            <Num label="Signups per network · 24h" value={draft.limits.signupsPerSubnetPerDay} onChange={(v) => update((c) => void (c.limits.signupsPerSubnetPerDay = v))} />
          </div>
          {issues.length > 0 ? <p className="mt-3 text-xs text-red-600">{issues.join(". ")}</p> : null}
          <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <DashboardField label="Reason for change">
              <input className={cn(dashboardInputClass, "w-72")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. bot wave from one network" />
            </DashboardField>
            <DashboardPrimaryButton disabled={!dirty || saving || issues.length > 0 || reason.trim().length < 5} onClick={() => void save()}>
              {saving ? "Saving…" : "Save"}
            </DashboardPrimaryButton>
            {dirty ? (
              <button type="button" className="text-sm font-semibold text-muted-foreground" onClick={() => data && setDraft(clone(data.config))}>
                Discard
              </button>
            ) : null}
            {data?.updatedAt ? (
              <span className="ml-auto text-xs text-muted-foreground">
                Last saved {formatWhen(data.updatedAt)}
                {data.updatedBy ? ` by ${data.updatedBy}` : ""}
              </span>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <Panel title="Blocklist" className="mt-5">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <DashboardField label="Type">
            <select className={dashboardInputClass} value={block.kind} onChange={(e) => setBlock((b) => ({ ...b, kind: e.target.value }))}>
              <option value="subnet">Network range</option>
              <option value="ip">IP</option>
              <option value="address">Wallet</option>
            </select>
          </DashboardField>
          <DashboardField label="Value">
            <input className={cn(dashboardInputClass, "w-64")} value={block.value} onChange={(e) => setBlock((b) => ({ ...b, value: e.target.value }))} placeholder="102.89.34.0/24, an IP, or 0x…" />
          </DashboardField>
          <DashboardField label="Note">
            <input className={cn(dashboardInputClass, "w-56")} value={block.reason} onChange={(e) => setBlock((b) => ({ ...b, reason: e.target.value }))} />
          </DashboardField>
          <DashboardPrimaryButton disabled={!block.value.trim()} onClick={() => void addBlock(block)}>
            Block
          </DashboardPrimaryButton>
        </div>
        {(data?.blocklist.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing blocked.</p>
        ) : (
          <div className="divide-y divide-border">
            {data!.blocklist.map((b) => (
              <div key={b.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-xs font-semibold uppercase text-muted-foreground">{b.kind}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{b.value}</span>
                <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground sm:block">{b.reason}</span>
                <button type="button" aria-label="Unblock" onClick={() => void removeBlock(b.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <h3 className="mb-3 mt-6 text-sm font-bold text-foreground">Recent requests</h3>
      <DashboardTableCard>
        <DashboardTableScroll>
          <table className="w-full">
            <DashboardTableHead>
              <DashboardTableHeadRow>
                <DashboardTableHeadCell>When</DashboardTableHeadCell>
                <DashboardTableHeadCell>Wallet</DashboardTableHeadCell>
                <DashboardTableHeadCell>Step</DashboardTableHeadCell>
                <DashboardTableHeadCell>Network</DashboardTableHeadCell>
                <DashboardTableHeadCell className="text-right">Amount</DashboardTableHeadCell>
                <DashboardTableHeadCell>Status</DashboardTableHeadCell>
                <DashboardTableHeadCell>{""}</DashboardTableHeadCell>
              </DashboardTableHeadRow>
            </DashboardTableHead>
            <DashboardTableBody>
              {(data?.recent ?? []).map((r) => (
                <DashboardTableRow key={r.id}>
                  <DashboardTableCell className="whitespace-nowrap text-xs">{formatWhen(r.createdAt)}</DashboardTableCell>
                  <DashboardTableCell className="font-mono text-xs">
                    <a href={`https://celoscan.io/address/${r.address}`} target="_blank" rel="noreferrer">
                      {short(r.address)}
                    </a>
                  </DashboardTableCell>
                  <DashboardTableCell className="text-xs">{r.stage ? STAGE_LABEL[r.stage as FaucetStage] ?? r.stage : "—"}</DashboardTableCell>
                  <DashboardTableCell className="font-mono text-xs">{r.ipSubnet ?? "—"}</DashboardTableCell>
                  <DashboardTableCell className="text-right text-xs tabular-nums">
                    {r.txHash ? (
                      <a href={`https://celoscan.io/tx/${r.txHash}`} target="_blank" rel="noreferrer">
                        {fmtCelo(r.amountCelo, 5)}
                      </a>
                    ) : (
                      fmtCelo(r.amountCelo, 5)
                    )}
                  </DashboardTableCell>
                  <DashboardTableCell>
                    <StatusChip status={r.status} />
                    {r.reason ? <p className="mt-1 text-[11px] text-muted-foreground">{REASON_LABEL[r.reason] ?? r.reason}</p> : null}
                  </DashboardTableCell>
                  <DashboardTableCell>
                    <div className="flex gap-2">
                      <button type="button" title="Block wallet" aria-label="Block wallet" onClick={() => void addBlock({ kind: "address", value: r.address, reason: "from recent requests" })}>
                        <Ban className="h-4 w-4 text-muted-foreground" />
                      </button>
                      {r.ipSubnet ? (
                        <button
                          type="button"
                          title="Block this network range"
                          className="text-[11px] font-semibold text-muted-foreground"
                          onClick={() => void addBlock({ kind: "subnet", value: r.ipSubnet!, reason: "from recent requests" })}
                        >
                          Block network
                        </button>
                      ) : null}
                    </div>
                  </DashboardTableCell>
                </DashboardTableRow>
              ))}
            </DashboardTableBody>
          </table>
          {data && data.recent.length === 0 ? <DashboardTableEmptyState title="No requests yet" /> : null}
        </DashboardTableScroll>
      </DashboardTableCard>
    </DashboardPage>
  );
}
