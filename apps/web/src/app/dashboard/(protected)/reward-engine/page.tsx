"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Copy, ExternalLink, RefreshCw } from "lucide-react";
import {
  DashboardPage,
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
  DashboardIconButton,
} from "@/components/dashboard/dashboard-ui";
import { DashboardSectionTabs, REWARD_ENGINE_SECTION_TABS } from "@/components/dashboard/dashboard-section-tabs";
import { REWARD_CATEGORIES, REWARD_CATEGORY_LABEL, adminFetch, formatG, formatWhen } from "@/components/admin/reward-engine-ui";
import type { RewardEngineOverviewDto } from "@/app/api/dashboard/reward-engine/overview/route";
import { cn } from "@/lib/utils";

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <h3 className="mb-4 text-sm font-bold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Line({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "warn" | "bad" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right font-semibold tabular-nums",
          tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-700" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default function RewardEngineOverviewPage() {
  const [data, setData] = useState<RewardEngineOverviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminFetch<RewardEngineOverviewDto>("/api/dashboard/reward-engine/overview"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = data?.stats;
  const vault = data && !("error" in data.vault) ? data.vault : null;
  const vaultError = data && "error" in data.vault ? data.vault.error : null;
  const poolAvailable = vault ? Number(vault.poolAvailable) : null;
  const shortfall = poolAvailable != null && data ? data.openLiabilities - poolAvailable : 0;
  const lowGas = vault ? Number(vault.celoBalance) < 1 : false;
  const disabled = data
    ? (["engine", ...REWARD_CATEGORIES] as const).filter((k) => !data.enabled[k])
    : [];

  return (
    <DashboardPage className="max-w-none px-5 sm:px-7">
      <DashboardSectionTabs items={REWARD_ENGINE_SECTION_TABS} />
      <div className="mb-5 flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          G$ paid by the Rewards Engine for approved proofs, weekly streaks and completions. Only confirmed on-chain
          credits count as distributed.
        </p>
        <DashboardIconButton title="Refresh" onClick={() => void load()}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </DashboardIconButton>
      </div>

      {error ? (
        <DashboardTableCard>
          <DashboardTableEmptyState title="Couldn’t load the overview" description={error} />
        </DashboardTableCard>
      ) : (
        <>
          {disabled.length > 0 ? (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {disabled.includes("engine")
                ? "The rewards engine is switched off — no new rewards are being granted."
                : `Switched off: ${disabled.map((k) => REWARD_CATEGORY_LABEL[k as keyof typeof REWARD_CATEGORY_LABEL]).join(", ")}.`}{" "}
              <Link href="/dashboard/reward-engine/settings" className="font-semibold underline">
                Settings
              </Link>
            </div>
          ) : null}

          <DashboardStatGrid>
            <DashboardStat label="Distributed (all time)" value={formatG(stats?.confirmed_total)} isLoading={loading && !data} />
            <DashboardStat label="Last 7 days" value={formatG(stats?.confirmed_7d)} isLoading={loading && !data} />
            <DashboardStat label="Recipients" value={stats?.recipients.toLocaleString() ?? "—"} isLoading={loading && !data} />
            <DashboardStat
              label={data?.dailyBudget ? `Sent today / ${formatG(data.dailyBudget)}` : "Sent today (UTC)"}
              value={formatG(stats?.sent_today_utc)}
              isLoading={loading && !data}
            />
          </DashboardStatGrid>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Panel title="RewardVault">
              {vaultError ? (
                <p className="text-sm text-red-600">Couldn’t read the vault: {vaultError}</p>
              ) : !vault ? (
                <div className="h-32 animate-pulse rounded-xl bg-muted" />
              ) : (
                <>
                  <Line label="Available pool" value={formatG(poolAvailable)} tone={poolAvailable === 0 ? "bad" : undefined} />
                  <Line label="Credited, not yet claimed" value={formatG(Number(vault.poolOwed))} />
                  <Line
                    label="Granted, not yet sent"
                    value={formatG(data?.openLiabilities)}
                    tone={shortfall > 0 ? "bad" : undefined}
                  />
                  <Line
                    label="Runway at last 7 days’ pace"
                    value={data?.runwayDays != null ? `${data.runwayDays.toLocaleString()} days` : "—"}
                    tone={data?.runwayDays != null && data.runwayDays < 14 ? "warn" : undefined}
                  />
                  <Line
                    label="Payout wallet gas"
                    value={`${Number(vault.celoBalance).toFixed(3)} CELO`}
                    tone={lowGas ? "warn" : undefined}
                  />
                  {shortfall > 0 ? (
                    <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                      The pool is {formatG(shortfall)} short of rewards already granted. They stay queued and go out
                      automatically once it’s funded.
                    </p>
                  ) : null}
                  {lowGas ? (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      The payout wallet {vault.address} is low on CELO for gas.
                    </p>
                  ) : null}
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Fund the pool by sending G$ to the vault (a plain transfer works; <code>fundPool</code> also logs
                      an event).
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-2.5 py-1.5 text-xs">{vault.vaultAddress}</code>
                      <DashboardIconButton
                        title={copied ? "Copied" : "Copy address"}
                        onClick={() => {
                          void navigator.clipboard.writeText(vault.vaultAddress).then(() => {
                            setCopied(true);
                            window.setTimeout(() => setCopied(false), 1500);
                          });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </DashboardIconButton>
                      <a
                        href={`https://celoscan.io/address/${vault.vaultAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1 rounded-xl border border-border px-3 text-xs font-semibold text-delulu-blue hover:bg-delulu-blue-light"
                      >
                        Celoscan <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </>
              )}
            </Panel>

            <Panel title="Needs attention">
              {!stats ? (
                <div className="h-32 animate-pulse rounded-xl bg-muted" />
              ) : (
                <>
                  <Link
                    href="/dashboard/reward-engine/activity?status=failed"
                    className="flex items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-muted/40"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">Failed</p>
                      <p className="text-xs text-muted-foreground">Retried automatically every 15 minutes</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-lg font-bold tabular-nums", stats.failed_count > 0 ? "text-red-600" : "text-foreground")}>
                        {stats.failed_count}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatG(stats.failed_total)}</p>
                    </div>
                  </Link>
                  <Link
                    href="/dashboard/reward-engine/activity?status=pending"
                    className="mt-2 flex items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-muted/40"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">Pending</p>
                      <p className="text-xs text-muted-foreground">
                        {stats.oldest_open_at ? `Oldest open since ${formatWhen(stats.oldest_open_at)}` : "Nothing waiting"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-lg font-bold tabular-nums", stats.pending_count > 0 ? "text-amber-700" : "text-foreground")}>
                        {stats.pending_count}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatG(stats.pending_total)}</p>
                    </div>
                  </Link>
                  <div className="mt-4 border-t border-border pt-3">
                    <Line label="Last 24 hours" value={formatG(stats.confirmed_24h)} />
                    <Line label="Last 30 days" value={formatG(stats.confirmed_30d)} />
                    {stats.legacy_sent_total > 0 ? (
                      <Line label="Old 10 G$ proof rewards (before the engine)" value={formatG(stats.legacy_sent_total)} />
                    ) : null}
                  </div>
                </>
              )}
            </Panel>
          </div>

          <DashboardTableCard>
            <DashboardTableScroll>
              <table className="w-full min-w-[720px] text-left text-sm">
                <DashboardTableHead>
                  <DashboardTableHeadRow>
                    <DashboardTableHeadCell>Category</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Status</DashboardTableHeadCell>
                    <DashboardTableHeadCell className="text-right">Distributed</DashboardTableHeadCell>
                    <DashboardTableHeadCell className="text-right">Rewards</DashboardTableHeadCell>
                    <DashboardTableHeadCell className="text-right">Pending</DashboardTableHeadCell>
                    <DashboardTableHeadCell className="text-right">Failed</DashboardTableHeadCell>
                  </DashboardTableHeadRow>
                </DashboardTableHead>
                <DashboardTableBody>
                  {REWARD_CATEGORIES.map((cat) => {
                    const c = stats?.by_category[cat];
                    const on = data ? data.enabled.engine && data.enabled[cat] : null;
                    return (
                      <DashboardTableRow key={cat}>
                        <DashboardTableCell className="font-semibold">
                          <Link href={`/dashboard/reward-engine/activity?category=${cat}`} className="hover:underline">
                            {REWARD_CATEGORY_LABEL[cat]}
                          </Link>
                        </DashboardTableCell>
                        <DashboardTableCell>
                          {on == null ? "—" : (
                            <span className={cn("text-xs font-semibold", on ? "text-emerald-700" : "text-muted-foreground")}>
                              {on ? "On" : "Off"}
                            </span>
                          )}
                        </DashboardTableCell>
                        <DashboardTableCell className="text-right tabular-nums">{formatG(c?.confirmed ?? 0)}</DashboardTableCell>
                        <DashboardTableCell className="text-right tabular-nums">{(c?.confirmed_count ?? 0).toLocaleString()}</DashboardTableCell>
                        <DashboardTableCell className="text-right tabular-nums">{formatG(c?.pending ?? 0)}</DashboardTableCell>
                        <DashboardTableCell className={cn("text-right tabular-nums", (c?.failed ?? 0) > 0 && "text-red-600")}>
                          {formatG(c?.failed ?? 0)}
                        </DashboardTableCell>
                      </DashboardTableRow>
                    );
                  })}
                </DashboardTableBody>
              </table>
            </DashboardTableScroll>
          </DashboardTableCard>
        </>
      )}
    </DashboardPage>
  );
}
