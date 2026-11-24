"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { DashboardPage } from "@/components/dashboard/dashboard-ui";
import { adminFetch } from "@/components/admin/reward-engine-ui";
import { GdScorecardPanel } from "@/components/dashboard/gd-scorecard-panel";
import type { SeasonEpochReport, SeasonPeriod, SeasonReport } from "@/lib/analytics/season";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("en-US");
const fmtG = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M` : n >= 10_000 ? `${Math.round(n / 1000)}k` : fmt(n));
const lagos = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", ...opts }).format(new Date(iso));
const range = (p: { start: string; end: string }) =>
  `${lagos(p.start, { day: "numeric", month: "short" })} – ${lagos(new Date(Date.parse(p.end) - 1).toISOString(), { day: "numeric", month: "short" })}`;

function Bar({ value, target, good = "bg-green-600" }: { value: number; target: number; good?: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <span className={cn("block h-full rounded-full", pct >= 100 ? good : "bg-foreground")} style={{ width: `${pct}%` }} />
    </span>
  );
}

function Tile({ label, value, sub, bar }: { label: string; value: string; sub?: string; bar?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums">{value}</p>
      {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
      {bar}
    </div>
  );
}

function PeriodTiles({ p }: { p: SeasonPeriod }) {
  const w2 = p.stillHereWeek2;
  const w2Rate = w2 != null && p.signups ? w2 / p.signups : null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Tile
        label="Acquired"
        value={fmt(p.signups)}
        sub={`${fmt(p.referredSignups)} referred · ${fmt(p.referralsCredited)} of ${fmt(p.spotsTarget)} spots`}
        bar={<Bar value={p.referralsCredited} target={p.spotsTarget} />}
      />
      <Tile
        label="Still here in week 2"
        value={w2Rate == null ? "measuring…" : `${Math.round(w2Rate * 100)}%`}
        sub={`target ${Math.round(p.retentionTarget * 100)}% · ${fmt(p.keptOneDay)} kept ≥1 day · ${fmt(p.activePlayers)} active`}
        bar={w2Rate == null ? undefined : <Bar value={w2Rate} target={p.retentionTarget} />}
      />
      <Tile label="Finished" value={fmt(p.finishedCards)} sub={`${fmt(p.finishedFirstWeek)} First Week`} />
      <Tile
        label="G$ circulation"
        value={`${fmtG(p.gCirculation)} / ${fmtG(p.circulationTarget)}`}
        sub={`${fmtG(p.gStaked)} staked · ${fmtG(p.gPaidOut)} paid out`}
        bar={<Bar value={p.gCirculation} target={p.circulationTarget} />}
      />
    </div>
  );
}

function EpochCard({ e, onSaveTarget }: { e: SeasonEpochReport; onSaveTarget: (epoch: number, target: number) => Promise<void> }) {
  const [open, setOpen] = useState(e.status === "live");
  const [target, setTarget] = useState(String(e.circulationTarget));
  const [saving, setSaving] = useState(false);
  const daysLeft = Math.max(0, Math.ceil((Date.parse(e.end) - Date.now()) / 86_400_000));
  return (
    <section className={cn("rounded-2xl border bg-card p-4 shadow-sm", e.status === "live" ? "border-foreground" : "border-border", e.status === "upcoming" && "opacity-70")}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <p className="text-sm font-extrabold">
            Epoch {e.number} · demo day {lagos(`${e.demoDay}T12:00:00Z`, { weekday: "short", day: "numeric", month: "short" })}
            {e.status === "live" ? <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">now · {daysLeft}d left</span> : null}
          </p>
          <p className="text-xs text-muted-foreground">{range(e)}</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="mt-3 flex flex-col gap-3">
          <PeriodTiles p={e} />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground">G$ circulation target</span>
            <input
              type="number"
              min={0}
              step={50_000}
              value={target}
              onChange={(ev) => setTarget(ev.target.value)}
              className="h-8 w-32 rounded-lg border border-border bg-background px-2 font-bold tabular-nums"
            />
            <button
              type="button"
              disabled={saving || Number(target) === e.circulationTarget}
              onClick={async () => {
                setSaving(true);
                await onSaveTarget(e.number, Number(target));
                setSaving(false);
              }}
              className="h-8 rounded-lg bg-foreground px-3 font-bold text-background disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <span className="text-muted-foreground">· referral spots per week are set on Referrals</span>
          </div>
          {e.weeks.map((w, i) => (
            <div key={w.start} className="rounded-xl bg-muted/40 p-3">
              <p className="mb-2 text-xs font-bold">
                Week {i + 1} · {range(w)}
                {w.status === "live" ? <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">now</span> : null}
              </p>
              <PeriodTiles p={w} />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Admin → Season: each 2-week epoch (ending on demo day) and its weeks — targets vs actuals. */
export default function SeasonDashboardPage() {
  const [data, setData] = useState<SeasonReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
    setError(null);
    try {
      setData(await adminFetch<SeasonReport>("/api/dashboard/season"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const saveTarget = async (epoch: number, circulationTarget: number) => {
    try {
      setData(
        await adminFetch<SeasonReport>("/api/dashboard/season", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ epoch, circulationTarget }),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const total = data?.epochs.reduce(
    (t, e) => ({ signups: t.signups + e.signups, credited: t.credited + e.referralsCredited, circ: t.circ + e.gCirculation, finished: t.finished + e.finishedCards }),
    { signups: 0, credited: 0, circ: 0, finished: 0 },
  );

  return (
    <DashboardPage className="max-w-none px-5 pb-16 sm:px-7">
      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Season</h2>
          <p className="text-sm text-muted-foreground">Six 2-week epochs, each ending on a Tuesday demo day. Acquisition, retention, finishers and G$ circulation against our targets.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-full border border-border p-2" aria-label="Refresh">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>
      {error ? <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {total ? (
        <p className="mb-4 text-sm font-semibold">
          Season so far: {fmt(total.signups)} sign-ups · {fmt(total.credited)} referrals counted · {fmt(total.finished)} cards finished · {fmtG(total.circ)} G$ circulated
        </p>
      ) : null}
      <GdScorecardPanel reloadKey={reloadKey} />
      {!data && !error ? <div className="h-40 animate-pulse rounded-2xl bg-muted" /> : null}
      <div className="flex flex-col gap-3">
        {(data?.epochs ?? []).map((e) => (
          <EpochCard key={e.number} e={e} onSaveTarget={saveTarget} />
        ))}
      </div>
    </DashboardPage>
  );
}
