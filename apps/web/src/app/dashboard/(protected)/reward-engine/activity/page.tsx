"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, RotateCw, X } from "lucide-react";
import { formatAddress } from "@/lib/utils";
import { AdminPagination } from "@/components/admin/admin-ui";
import {
  DashboardField,
  DashboardModal,
  DashboardPage,
  DashboardPrimaryButton,
  DashboardSelect,
  DashboardTableBody,
  DashboardTableCard,
  DashboardTableCell,
  DashboardTableEmptyState,
  DashboardTableHead,
  DashboardTableHeadCell,
  DashboardTableHeadRow,
  DashboardTableLoading,
  DashboardTableRow,
  DashboardTableScroll,
  StatusChip,
  dashboardInputClass,
  useDashboardToast,
} from "@/components/dashboard/dashboard-ui";
import { DashboardSectionTabs, REWARD_ENGINE_SECTION_TABS } from "@/components/dashboard/dashboard-section-tabs";
import { REWARD_CATEGORIES, REWARD_CATEGORY_LABEL, adminFetch, formatG, formatWhen } from "@/components/admin/reward-engine-ui";
import type { RewardActivityDto, RewardActivityRow } from "@/app/api/dashboard/reward-engine/activity/route";

const FILTER_KEYS = ["user", "campaign", "category", "status", "from", "to"] as const;
type Filters = Record<(typeof FILTER_KEYS)[number], string>;

function ActivityInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { show: toast } = useDashboardToast();

  // URL is the source of truth, so Overview links and shared links land pre-filtered.
  const applied: Filters = useMemo(
    () => Object.fromEntries(FILTER_KEYS.map((k) => [k, searchParams.get(k) ?? ""])) as Filters,
    [searchParams],
  );
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [draft, setDraft] = useState<Filters>(applied);
  useEffect(() => setDraft(applied), [applied]);

  const [data, setData] = useState<RewardActivityDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<RewardActivityRow | null>(null);
  const [retryReason, setRetryReason] = useState("");
  const [retryBusy, setRetryBusy] = useState(false);

  const pushParams = useCallback(
    (next: Partial<Filters> & { page?: number }) => {
      const params = new URLSearchParams();
      const merged = { ...applied, ...next };
      for (const k of FILTER_KEYS) if (merged[k]) params.set(k, merged[k]);
      if (next.page && next.page > 1) params.set("page", String(next.page));
      router.replace(`${pathname}${params.size ? `?${params}` : ""}`);
    },
    [applied, pathname, router],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const k of FILTER_KEYS) if (applied[k]) params.set(k, applied[k]);
      params.set("page", String(page));
      setData(await adminFetch<RewardActivityDto>(`/api/dashboard/reward-engine/activity?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasFilters = FILTER_KEYS.some((k) => applied[k]);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  async function confirmRetry() {
    if (!retrying) return;
    setRetryBusy(true);
    try {
      const res = await adminFetch<{ status: string; lastError: string | null }>("/api/dashboard/reward-engine/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: retrying.id, reason: retryReason }),
      });
      toast(
        res.status === "confirmed"
          ? "Sent and confirmed"
          : res.status === "submitted"
            ? "Sent — waiting for confirmation"
            : `Still ${res.status}${res.lastError ? `: ${res.lastError}` : ""}`,
      );
      setRetrying(null);
      setRetryReason("");
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryBusy(false);
    }
  }

  return (
    <DashboardPage className="max-w-none px-5 sm:px-7">
      <DashboardSectionTabs items={REWARD_ENGINE_SECTION_TABS} />

      <form
        className="mb-4 grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          pushParams({ ...draft, page: 1 });
        }}
      >
        <DashboardField label="User">
          <input
            className={dashboardInputClass}
            placeholder="0x… or username"
            value={draft.user}
            onChange={(e) => setDraft({ ...draft, user: e.target.value })}
          />
        </DashboardField>
        <DashboardField label="Campaign">
          <input
            className={dashboardInputClass}
            placeholder="Title or id"
            value={draft.campaign}
            onChange={(e) => setDraft({ ...draft, campaign: e.target.value })}
          />
        </DashboardField>
        <DashboardField label="Category">
          <DashboardSelect value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            <option value="">All</option>
            {REWARD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {REWARD_CATEGORY_LABEL[c]}
              </option>
            ))}
          </DashboardSelect>
        </DashboardField>
        <DashboardField label="Status">
          <DashboardSelect value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
            <option value="">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </DashboardSelect>
        </DashboardField>
        <DashboardField label="From">
          <input type="date" className={dashboardInputClass} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </DashboardField>
        <DashboardField label="To">
          <input type="date" className={dashboardInputClass} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </DashboardField>
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-6">
          <DashboardPrimaryButton type="submit">Apply filters</DashboardPrimaryButton>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => router.replace(pathname)}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          ) : null}
        </div>
      </form>

      {data ? (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-xl border border-border bg-card px-3 py-2">
            <span className="font-bold tabular-nums">{data.total.toLocaleString()}</span>{" "}
            <span className="text-muted-foreground">rewards</span>
          </span>
          <span className="rounded-xl border border-border bg-card px-3 py-2">
            <span className="font-bold tabular-nums text-emerald-700">{formatG(data.sums.confirmed)}</span>{" "}
            <span className="text-muted-foreground">confirmed</span>
          </span>
          <span className="rounded-xl border border-border bg-card px-3 py-2">
            <span className="font-bold tabular-nums text-amber-700">{formatG(data.sums.pending)}</span>{" "}
            <span className="text-muted-foreground">pending</span>
          </span>
          <span className="rounded-xl border border-border bg-card px-3 py-2">
            <span className="font-bold tabular-nums text-red-600">{formatG(data.sums.failed)}</span>{" "}
            <span className="text-muted-foreground">failed</span>
          </span>
        </div>
      ) : null}

      <DashboardTableCard>
        {loading ? (
          <DashboardTableLoading />
        ) : error ? (
          <DashboardTableEmptyState title="Couldn’t load reward activity" description={error} />
        ) : !data || data.rows.length === 0 ? (
          <DashboardTableEmptyState
            title={hasFilters ? "No rewards match these filters" : "No rewards yet"}
            description={hasFilters ? "Try a wider date range or clear a filter." : "Rewards appear here as proofs are approved."}
          />
        ) : (
          <>
            <DashboardTableScroll>
              <table className="w-full min-w-[1040px] text-left text-sm">
                <DashboardTableHead>
                  <DashboardTableHeadRow>
                    <DashboardTableHeadCell>Granted</DashboardTableHeadCell>
                    <DashboardTableHeadCell>User</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Category</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Goal / campaign</DashboardTableHeadCell>
                    <DashboardTableHeadCell className="text-right">Amount</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Status</DashboardTableHeadCell>
                    <DashboardTableHeadCell className="w-36 text-right">Tx</DashboardTableHeadCell>
                  </DashboardTableHeadRow>
                </DashboardTableHead>
                <DashboardTableBody>
                  {data.rows.map((r) => (
                    <DashboardTableRow key={r.id}>
                      <DashboardTableCell className="whitespace-nowrap text-muted-foreground">{formatWhen(r.createdAt)}</DashboardTableCell>
                      <DashboardTableCell>
                        <button
                          type="button"
                          className="text-left hover:underline"
                          title="Show only this user"
                          onClick={() => pushParams({ user: r.wallet, page: 1 })}
                        >
                          <p className="font-semibold text-foreground">
                            {r.username ? `@${r.username}` : formatAddress(r.wallet as `0x${string}`)}
                          </p>
                          {r.username ? (
                            <p className="font-mono text-[11px] text-muted-foreground">{formatAddress(r.wallet as `0x${string}`)}</p>
                          ) : null}
                        </button>
                      </DashboardTableCell>
                      <DashboardTableCell>{REWARD_CATEGORY_LABEL[r.category]}</DashboardTableCell>
                      <DashboardTableCell className="max-w-[240px]">
                        {r.goalTitle ? (
                          r.goalKind === "campaign" && r.goalRef ? (
                            <button
                              type="button"
                              className="line-clamp-2 text-left hover:underline"
                              title="Show only this campaign"
                              onClick={() => pushParams({ campaign: r.goalRef!, page: 1 })}
                            >
                              {r.goalTitle}
                            </button>
                          ) : (
                            <span className="line-clamp-2">{r.goalTitle}</span>
                          )
                        ) : r.category === "weekly_consistency" ? (
                          <span className="text-muted-foreground">Week {r.periodKey}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </DashboardTableCell>
                      <DashboardTableCell className="text-right font-semibold tabular-nums">{formatG(r.amount)}</DashboardTableCell>
                      <DashboardTableCell>
                        <StatusChip status={r.status} />
                        {r.lastError && r.status !== "confirmed" ? (
                          <p className="mt-1 max-w-[220px] truncate text-[11px] text-muted-foreground" title={r.lastError}>
                            {r.lastError}
                          </p>
                        ) : null}
                        {r.attempts > 1 ? <p className="text-[11px] text-muted-foreground">{r.attempts} attempts</p> : null}
                      </DashboardTableCell>
                      <DashboardTableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === "failed" || r.status === "pending" ? (
                            <button
                              type="button"
                              onClick={() => setRetrying(r)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                            >
                              <RotateCw className="h-3 w-3" /> Retry
                            </button>
                          ) : null}
                          {r.txHash ? (
                            <a
                              href={`https://celoscan.io/tx/${r.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-delulu-blue hover:bg-delulu-blue-light"
                            >
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </div>
                      </DashboardTableCell>
                    </DashboardTableRow>
                  ))}
                </DashboardTableBody>
              </table>
            </DashboardTableScroll>
            <AdminPagination page={page} totalPages={totalPages} onPage={(p) => pushParams({ page: p })} />
          </>
        )}
      </DashboardTableCard>

      <DashboardModal
        open={!!retrying}
        onOpenChange={(open) => {
          if (!open && !retryBusy) {
            setRetrying(null);
            setRetryReason("");
          }
        }}
        title="Send this reward now?"
        description="It goes through the normal payout checks, so it can never be paid twice. This is recorded in the audit log."
      >
        {retrying ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
              <p className="font-semibold">
                {formatG(retrying.amount)} · {REWARD_CATEGORY_LABEL[retrying.category]}
              </p>
              <p className="text-muted-foreground">
                {retrying.username ? `@${retrying.username}` : retrying.wallet} · {retrying.status}
                {retrying.lastError ? ` · ${retrying.lastError}` : ""}
              </p>
            </div>
            <DashboardField label="Reason" required>
              <input
                className={dashboardInputClass}
                placeholder="e.g. Pool topped up"
                value={retryReason}
                onChange={(e) => setRetryReason(e.target.value)}
              />
            </DashboardField>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={retryBusy}
                onClick={() => setRetrying(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <DashboardPrimaryButton disabled={retryBusy || retryReason.trim().length < 3} onClick={() => void confirmRetry()}>
                {retryBusy ? "Sending…" : "Send now"}
              </DashboardPrimaryButton>
            </div>
          </div>
        ) : null}
      </DashboardModal>
    </DashboardPage>
  );
}

export default function RewardEngineActivityPage() {
  return (
    <Suspense fallback={<DashboardPage><DashboardTableLoading /></DashboardPage>}>
      <ActivityInner />
    </Suspense>
  );
}
