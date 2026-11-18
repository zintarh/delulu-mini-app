"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Mail, RefreshCw, Smartphone } from "lucide-react";
import { DashboardPage, DashboardStat, DashboardStatGrid } from "@/components/dashboard/dashboard-ui";
import { DashboardSectionTabs, PEOPLE_SECTION_TABS } from "@/components/dashboard/dashboard-section-tabs";
import { adminFetch } from "@/components/admin/reward-engine-ui";
import type { AnalyticsDto, AnalyticsPerson } from "@/app/api/dashboard/analytics/route";
import { RULE_LABEL } from "@/lib/nudges/rules";
import type { FunnelKey } from "@/lib/nudges/people";
import { cn } from "@/lib/utils";

const RANGES = [7, 14, 30] as const;
const fmt = (n: number) => n.toLocaleString("en-US");

function ago(iso: string | null): string {
  if (!iso) return "—";
  const h = Math.floor((Date.now() - Date.parse(iso)) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Card({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      <h3 className="text-sm font-extrabold text-foreground">{title}</h3>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Admin → People → Retention: who signs up, where they drop off in the first days, and what the nudges do about it. */
export default function RetentionAnalyticsPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(14);
  const [data, setData] = useState<AnalyticsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stuckTab, setStuckTab] = useState<FunnelKey>("onboarded");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminFetch<AnalyticsDto>(`/api/dashboard/analytics?days=${days}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [days]);
  useEffect(() => {
    void load();
  }, [load]);

  const t = data?.totals;
  const max = data?.funnel[0]?.count || 1;
  const stuckSteps = (data?.funnel ?? []).filter((s) => s.key !== "week2");

  return (
    <DashboardPage className="max-w-none px-5 pb-16 sm:px-7">
      <DashboardSectionTabs items={PEOPLE_SECTION_TABS} />

      <div className="mb-5 mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Retention</h2>
          <p className="text-sm text-muted-foreground">People who signed up in the last {days} days — where they drop off, and who the nudges are reaching.</p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              className={cn("rounded-full border px-3 py-1.5 text-xs font-bold", days === r ? "border-foreground bg-foreground text-background" : "border-border")}
            >
              {r} days
            </button>
          ))}
          <button type="button" onClick={() => void load()} className="rounded-full border border-border p-2" aria-label="Refresh">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <DashboardStatGrid className="sm:grid-cols-6">
        <DashboardStat label="Signups" value={t ? fmt(t.signups) : "—"} isLoading={!data} />
        <DashboardStat label="Active today" value={t ? fmt(t.activeToday) : "—"} isLoading={!data} />
        <DashboardStat label="Playing a Bingo" value={t ? fmt(t.playingNow) : "—"} isLoading={!data} />
        <DashboardStat label="App installed" value={t ? `${fmt(t.installed)} (${t.signups ? Math.round((t.installed / t.signups) * 100) : 0}%)` : "—"} isLoading={!data} />
        <DashboardStat label="Push on" value={t ? `${fmt(t.pushOn)} (${t.signups ? Math.round((t.pushOn / t.signups) * 100) : 0}%)` : "—"} isLoading={!data} />
        <DashboardStat label="Has email" value={t ? fmt(t.hasEmail) : "—"} isLoading={!data} />
      </DashboardStatGrid>

      {data && !data.trackingSince ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Install and &ldquo;last seen&rdquo; tracking starts once the 20261118_nudges migration is run and people open the new app version — until then those numbers read 0.
        </p>
      ) : null}

      {/* The number to move: 1 in 10 new people still here in their second week. */}
      {data?.weekly ? (
        <Card
          className="mb-4"
          title={`Still here after week 1 · target ${Math.round(data.weekly.target * 100)}%`}
          sub={`People who signed up each week and kept a day 7–13 days later. ${fmt(data.weekly.activeLast7d)} people kept a day in the last 7 days.`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-semibold">Week of</th>
                  <th className="py-1.5 pr-3 font-semibold">Signups</th>
                  <th className="py-1.5 pr-3 font-semibold">Kept ≥1 day</th>
                  <th className="py-1.5 font-semibold">Still here in week 2</th>
                </tr>
              </thead>
              <tbody>
                {data.weekly.cohorts.map((c) => {
                  const rate = c.week1 != null && c.signups ? c.week1 / c.signups : null;
                  return (
                    <tr key={c.week} className="border-t border-border">
                      <td className="py-1.5 pr-3 font-semibold">{c.week}</td>
                      <td className="py-1.5 pr-3">{fmt(c.signups)}</td>
                      <td className="py-1.5 pr-3">
                        {fmt(c.started)} ({c.signups ? Math.round((c.started / c.signups) * 100) : 0}%)
                      </td>
                      <td className="py-1.5">
                        {rate == null ? (
                          <span className="text-muted-foreground">measuring…</span>
                        ) : (
                          <span className={cn("rounded-full px-2 py-0.5 font-bold", rate >= data.weekly.target ? "bg-green-100 text-green-800" : "bg-red-50 text-red-700")}>
                            {fmt(c.week1!)} · {Math.round(rate * 100)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="First-days funnel" sub="How far people got. The biggest drop is where to act.">
          <div className="flex flex-col gap-2">
            {(data?.funnel ?? []).map((s, i, arr) => {
              const prev = i > 0 ? arr[i - 1].count : s.count;
              const drop = i > 0 && prev > 0 ? Math.round(((prev - s.count) / prev) * 100) : 0;
              return (
                <div key={s.key} className="grid grid-cols-[150px_1fr_90px] items-center gap-2 text-xs">
                  <span className="truncate font-semibold">{s.label}</span>
                  <span className="h-5 overflow-hidden rounded-md bg-muted">
                    <span className="block h-full rounded-md bg-emerald-500" style={{ width: `${(s.count / max) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums">
                    <b>{fmt(s.count)}</b> {i > 0 && drop > 0 ? <span className="text-red-600">−{drop}%</span> : <span className="text-muted-foreground">{s.pct}%</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Installed the app vs not" sub="Does having Delulu on the home screen keep people going?">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1">Group</th>
                <th className="py-1 text-right">People</th>
                <th className="py-1 text-right">Day 1</th>
                <th className="py-1 text-right">Day 3</th>
                <th className="py-1 text-right">Finished</th>
              </tr>
            </thead>
            <tbody>
              {(data?.installSplit ?? []).map((g) => (
                <tr key={g.group} className="border-t border-border">
                  <td className="py-1.5 font-semibold">{g.group}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmt(g.people)}</td>
                  <td className="py-1.5 text-right tabular-nums">{g.day1Pct}%</td>
                  <td className="py-1.5 text-right tabular-nums">{g.day3Pct}%</td>
                  <td className="py-1.5 text-right tabular-nums">{g.completedPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Signups by day" sub="Each day's new people and how far they've got so far.">
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card text-left text-muted-foreground">
                <tr>
                  <th className="py-1">Day</th>
                  <th className="py-1 text-right">Signups</th>
                  <th className="py-1 text-right">Set up</th>
                  <th className="py-1 text-right">Started</th>
                  <th className="py-1 text-right">Day 1</th>
                  <th className="py-1 text-right">Day 3</th>
                  <th className="py-1 text-right">Finished</th>
                </tr>
              </thead>
              <tbody>
                {(data?.cohorts ?? []).map((c) => (
                  <tr key={c.day} className="border-t border-border tabular-nums">
                    <td className="py-1.5 font-semibold">{c.day.slice(5)}</td>
                    <td className="py-1.5 text-right">{c.signups}</td>
                    <td className="py-1.5 text-right">{c.onboarded}</td>
                    <td className="py-1.5 text-right">{c.started}</td>
                    <td className="py-1.5 text-right">{c.day1}</td>
                    <td className="py-1.5 text-right">{c.day3}</td>
                    <td className="py-1.5 text-right">{c.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Automatic nudges" sub="Runs every 30 min: one a day per person, quiet 10pm–8am Lagos, push first, email if push is off.">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1">Nudge</th>
                <th className="py-1 text-right">Due now</th>
                <th className="py-1 text-right">Sent (7d)</th>
                <th className="py-1 text-right">Acted on</th>
              </tr>
            </thead>
            <tbody>
              {(data?.nudges ?? []).map((n) => (
                <tr key={n.rule} className="border-t border-border tabular-nums">
                  <td className="py-1.5 font-semibold">{n.label}</td>
                  <td className="py-1.5 text-right">{n.dueNow}</td>
                  <td className="py-1.5 text-right">{n.sent7d}</td>
                  <td className="py-1.5 text-right">{n.sent7d ? `${n.acted7d} (${Math.round((n.acted7d / n.sent7d) * 100)}%)` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Who's stuck where" sub="People who signed up over a day ago, by the furthest step they reached." className="mt-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {stuckSteps.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStuckTab(s.key)}
              className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold", stuckTab === s.key ? "border-foreground bg-foreground text-background" : "border-border")}
            >
              {s.label} · {data?.stuck[s.key]?.length ?? 0}
            </button>
          ))}
        </div>
        <PeopleTable rows={data?.stuck[stuckTab] ?? []} />
      </Card>
    </DashboardPage>
  );
}

function PeopleTable({ rows }: { rows: AnalyticsPerson[] }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Nobody here.</p>;
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card text-left text-muted-foreground">
          <tr>
            <th className="py-1">Person</th>
            <th className="py-1">Joined</th>
            <th className="py-1">Last seen</th>
            <th className="py-1">Reach</th>
            <th className="py-1">Next nudge</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.wallet} className="border-t border-border">
              <td className="py-1.5 font-semibold">{p.username ? `@${p.username}` : `${p.wallet.slice(0, 6)}…${p.wallet.slice(-4)}`}</td>
              <td className="py-1.5">{ago(p.createdAt)}</td>
              <td className="py-1.5">{ago(p.lastSeenAt)}</td>
              <td className="py-1.5">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Smartphone className={cn("h-3.5 w-3.5", p.installed ? "text-emerald-600" : "opacity-30")} aria-label={p.installed ? "Installed" : "Not installed"} />
                  <BellRing className={cn("h-3.5 w-3.5", p.pushOn ? "text-emerald-600" : "opacity-30")} aria-label={p.pushOn ? "Push on" : "Push off"} />
                  <Mail className={cn("h-3.5 w-3.5", p.hasEmail ? "text-emerald-600" : "opacity-30")} aria-label={p.hasEmail ? "Has email" : "No email"} />
                </span>
              </td>
              <td className="py-1.5">{p.nextNudge ? RULE_LABEL[p.nextNudge] : <span className="text-muted-foreground">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
