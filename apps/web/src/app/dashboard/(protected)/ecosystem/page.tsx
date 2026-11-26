"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { DashboardPage } from "@/components/dashboard/dashboard-ui";
import { adminFetch } from "@/components/admin/reward-engine-ui";
import type { EcosystemReport, ShareProject } from "@/lib/ecosystem/gd-share";
import type { Sustainability } from "@/lib/celo/reward-vault-payout";
import { cn } from "@/lib/utils";

const SEASON_START = "2026-11-16";
const US = "#1f9a5b"; // Delulu (green-strong) — passes 3:1 on white as a mark
const THEM = "#8a8a83"; // every other project (faint)

const lagosToday = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtG = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 10_000 ? `${Math.round(n / 1000)}k` : fmt(n));
const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

type Range = "season" | "7" | "14" | "30";

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums">{value}</p>
      {sub ? <p className={cn("text-[11px]", tone === "good" ? "text-green-700" : tone === "bad" ? "text-orange" : "text-muted-foreground")}>{sub}</p> : null}
    </div>
  );
}

export default function EcosystemPage() {
  const [range, setRange] = useState<Range>("season");
  const [data, setData] = useState<(EcosystemReport & { sustainability?: Sustainability | null }) | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const to = lagosToday();
  const from = range === "season" ? SEASON_START : addDays(to, -(Number(range) - 1));

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try { setData(await adminFetch<EcosystemReport>(`/api/dashboard/ecosystem?from=${from}&to=${to}`)); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);

  /** Read days from the chain one by one (about a minute each), then reload. */
  const compute = async (days: string[]) => {
    setErr("");
    for (const [i, day] of days.entries()) {
      setBusy(`Reading ${dayLabel(day)} from Celo (${i + 1} of ${days.length})…`);
      try {
        await adminFetch("/api/dashboard/ecosystem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "compute", day }) });
      } catch (e) {
        setErr(`${dayLabel(day)}: ${e instanceof Error ? e.message : String(e)}`);
        break;
      }
    }
    setBusy(null);
    await load();
  };

  const view = useMemo(() => (data ? summarize(data) : null), [data]);

  return (
    <DashboardPage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">G$ ecosystem share</h1>
          <p className="text-sm text-muted-foreground">Each GoodBuilders project&apos;s share of the G$ moving through the projects&apos; contracts, per Lagos day.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Date range">
            {(["season", "7", "14", "30"] as const).map((r) => (
              <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r}
                className={cn("rounded-md px-3 py-1.5 text-sm font-semibold", range === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                {r === "season" ? "Season" : `${r}d`}
              </button>
            ))}
          </div>
          <button type="button" disabled={!!busy} onClick={() => void compute([to])} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Update today
          </button>
          {data && data.missing.filter((d) => d !== to).length > 0 ? (
            <button type="button" disabled={!!busy} onClick={() => void compute(data.missing.filter((d) => d !== to))} className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-semibold text-background disabled:opacity-50">
              Fill {data.missing.filter((d) => d !== to).length} missing day{data.missing.filter((d) => d !== to).length === 1 ? "" : "s"}
            </button>
          ) : null}
        </div>
      </div>

      {data ? <SustainabilityPanel s={data.sustainability ?? null} /> : null}

      {busy ? <p className="mt-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> {busy} Keep this tab open.</p> : null}
      {err ? <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{err}</p> : null}

      {view && view.days.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No days stored yet. Press <b>Fill missing days</b> to read them from Celo.</p>
      ) : null}

      {view && view.days.length > 0 ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Tile label={`${view.us?.name ?? "Us"} share`} value={view.us ? pct(view.us.share) : "—"} sub={`of ${fmtG(view.listed)} G$ through all projects`} />
            <Tile label="Rank by G$" value={view.us ? `#${view.us.rank} of ${view.board.length}` : "—"} sub={view.gapText} tone={view.us?.rank === 1 ? "good" : undefined} />
            <Tile label="G$ volume" value={view.us ? `${fmtG(view.us.volume)} G$` : "—"} sub={view.us ? `${fmtG(view.us.volume / view.days.length)} a day` : undefined} />
            <Tile label="Rank by transactions" value={view.us ? `#${view.us.txRank}` : "—"} sub={view.us ? `${fmt(view.us.txs)} transactions` : undefined} />
            <Tile label="Share of all G$ on Celo" value={view.us ? pct(view.us.volume / Math.max(1, view.network), 2) : "—"} sub={`${fmtG(view.network)} G$ moved on Celo`} />
            <Tile label="Trend" value={view.trend == null ? "—" : `${view.trend >= 0 ? "+" : ""}${(view.trend * 100).toFixed(1)} pts`} sub="last 3 days vs the 3 before" tone={view.trend == null ? undefined : view.trend >= 0 ? "good" : "bad"} />
          </div>

          {view.us ? <ShareLine days={view.days} name={view.us.name} /> : null}

          <section className="mt-5 rounded-xl border border-border p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-extrabold uppercase tracking-wide">Leaderboard · {dayLabel(view.days[0].day)} – {dayLabel(view.days[view.days.length - 1].day)}</h2>
              <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: US }} /> {view.us?.name ?? "Us"}</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: THEM }} /> Other projects</span>
              </span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr><th className="py-1.5 pr-2">#</th><th className="py-1.5 pr-2">Project</th><th className="w-[34%] py-1.5 pr-2">Share of G$</th><th className="py-1.5 pr-2 text-right">G$ volume</th><th className="py-1.5 pr-2 text-right">Txs</th><th className="py-1.5 pr-2 text-right">Users</th><th className="py-1.5 pr-2 text-right">Wallet-days*</th><th className="py-1.5 pr-2 text-right">Days #1</th><th className="py-1.5 text-right">Best day</th></tr>
                </thead>
                <tbody>
                  {view.board.map((p) => (
                    <tr key={p.name} className={cn("border-t border-border", p.isUs && "bg-green-500/5 font-bold")}>
                      <td className="py-2 pr-2 tabular-nums">{p.rank}</td>
                      <td className="py-2 pr-2">{p.name}</td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2" title={`${p.name}: ${pct(p.share, 2)} · ${fmt(p.volume)} G$`}>
                          <span className="block h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <span className="block h-full rounded-full" style={{ width: `${Math.max(p.share > 0 ? 1.5 : 0, (p.share / Math.max(1e-9, view.board[0].share)) * 100)}%`, background: p.isUs ? US : THEM }} />
                          </span>
                          <span className="w-14 text-right tabular-nums">{pct(p.share)}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{fmt(p.volume)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{fmt(p.txs)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{p.users == null ? <span title="Some days have no wallet list yet. Recompute them below.">—</span> : <>{fmt(p.users)}{p.usersRank === 1 && p.users > 0 ? <span className="ml-1 text-[10px] text-green-700">#1</span> : null}</>}</td>
                      <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">{fmt(p.walletDays)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{p.daysFirst}</td>
                      <td className="py-2 text-right tabular-nums">{p.best ? `${pct(p.best.share)} · ${dayLabel(p.best.day)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Share = the project&apos;s G$ in + out of its contracts ÷ all the projects&apos; combined. Moves between a project&apos;s own contracts don&apos;t count. Users = different wallets that sent G$ to or got G$ from the project&apos;s contracts in this range, each counted once. *Wallet-days count a wallet again on every day it shows up.</p>
          </section>

          <DailyTable view={view} today={to} onRecompute={(d) => void compute([d])} busy={!!busy} />
        </>
      ) : null}

      {data ? <Projects projects={data.projects} onChanged={load} /> : null}
    </DashboardPage>
  );
}

// ── Numbers ───────────────────────────────────────────────────────────────────

function summarize(data: EcosystemReport) {
  const names = data.projects.map((p) => p.name);
  const isUs = new Set(data.projects.filter((p) => p.isUs).map((p) => p.name));
  const days = data.days.map((d) => {
    const listed = d.rows.reduce((n, r) => n + r.volume, 0);
    const shares = new Map(d.rows.map((r) => [r.project, listed > 0 ? r.volume / listed : 0]));
    const ranked = [...d.rows].sort((a, b) => b.volume - a.volume);
    return { ...d, listed, shares, leader: ranked[0]?.volume > 0 ? ranked[0].project : null, rank: new Map(ranked.map((r, i) => [r.project, i + 1])) };
  });
  const listed = days.reduce((n, d) => n + d.listed, 0);
  const network = days.reduce((n, d) => n + d.totalG, 0);
  const board = names.map((name) => {
    let volume = 0, txs = 0, walletDays = 0, daysFirst = 0;
    let best: { day: string; share: number } | null = null;
    for (const d of days) {
      const r = d.rows.find((x) => x.project === name);
      if (!r) continue;
      volume += r.volume; txs += r.txs; walletDays += r.wallets;
      if (d.leader === name) daysFirst++;
      const s = d.shares.get(name) ?? 0;
      if (s > 0 && (!best || s > best.share)) best = { day: d.day, share: s };
    }
    const users = data.users?.[name] ?? null;
    return { name, isUs: isUs.has(name), volume, txs, walletDays, users, daysFirst, best, share: listed > 0 ? volume / listed : 0, rank: 0, txRank: 0, usersRank: 0 };
  }).sort((a, b) => b.volume - a.volume);
  [...board].sort((a, b) => (b.users ?? -1) - (a.users ?? -1)).forEach((p, i) => { p.usersRank = p.users == null ? 0 : i + 1; });
  board.forEach((p, i) => { p.rank = i + 1; });
  [...board].sort((a, b) => b.txs - a.txs).forEach((p, i) => { p.txRank = i + 1; });
  const us = board.find((p) => p.isUs) ?? null;

  let gapText: string | undefined;
  if (us && us.rank > 1) {
    const above = board[us.rank - 2];
    gapText = `${fmtG(above.volume - us.volume)} G$ behind ${above.name}`;
  } else if (us && board[1]) {
    gapText = `${fmtG(us.volume - board[1].volume)} G$ ahead of ${board[1].name}`;
  }

  // Our share, last 3 days vs the 3 before.
  let trend: number | null = null;
  if (us && days.length >= 6) {
    const s = (ds: typeof days) => {
      const l = ds.reduce((n, d) => n + d.listed, 0);
      const v = ds.reduce((n, d) => n + (d.rows.find((r) => r.project === us.name)?.volume ?? 0), 0);
      return l > 0 ? v / l : 0;
    };
    trend = s(days.slice(-3)) - s(days.slice(-6, -3));
  }
  return { days, listed, network, board, us, gapText, trend, names };
}

type View = ReturnType<typeof summarize>;

// ── Our daily share (one series: no legend, the title names it) ──────────────

function ShareLine({ days, name }: { days: View["days"]; name: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000, H = 220, PL = 44, PR = 12, PT = 14, PB = 28;
  const vals = days.map((d) => d.shares.get(name) ?? 0);
  const max = Math.max(0.1, Math.ceil(Math.max(...vals) * 10) / 10);
  const x = (i: number) => PL + (days.length === 1 ? (W - PL - PR) / 2 : (i * (W - PL - PR)) / (days.length - 1));
  const y = (v: number) => PT + (1 - v / max) * (H - PT - PB);
  const path = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ticks = [0, max / 2, max];
  const h = hover != null ? days[hover] : null;
  return (
    <section className="mt-5 rounded-xl border border-border p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide">{name}&apos;s daily share of G$</h2>
      <div className="relative mt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[220px] w-full" role="img" aria-label={`${name}'s share of G$ per day`} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={PL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="currentColor" fillOpacity={0.6}>{Math.round(t * 100)}%</text>
            </g>
          ))}
          {days.map((d, i) => (i % Math.ceil(days.length / 10) === 0 || i === days.length - 1 ? (
            <text key={d.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity={0.6}>{d.day.slice(8)}/{d.day.slice(5, 7)}</text>
          ) : null))}
          {hover != null ? <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="currentColor" strokeOpacity={0.3} /> : null}
          <path d={path} fill="none" stroke={US} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {vals.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 6 : 4} fill={US} stroke="white" strokeWidth={2} opacity={days[i].complete ? 1 : 0.5} />
          ))}
          {days.map((d, i) => (
            <rect key={`hit-${d.day}`} x={x(i) - (W - PL - PR) / Math.max(2, days.length) / 2} y={0} width={(W - PL - PR) / Math.max(2, days.length)} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
        {h ? (
          <div className="pointer-events-none absolute top-0 rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md" style={{ left: `clamp(0px, calc(${(x(hover!) / W) * 100}% - 90px), calc(100% - 180px))` }}>
            <p className="font-bold">{dayLabel(h.day)}{h.complete ? "" : " (so far)"}</p>
            <p>{name}: <b>{pct(h.shares.get(name) ?? 0)}</b> · #{h.rank.get(name) ?? "—"}</p>
            <p className="text-muted-foreground">{fmt(h.rows.find((r) => r.project === name)?.volume ?? 0)} G$ of {fmt(h.listed)}</p>
            {h.leader && h.leader !== name ? <p className="text-muted-foreground">Top: {h.leader} {pct(h.shares.get(h.leader) ?? 0)}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ── Every project, every day ────────────────────────────────────────────────

function DailyTable({ view, today, onRecompute, busy }: { view: View; today: string; onRecompute: (d: string) => void; busy: boolean }) {
  const cols = view.board.filter((p) => p.volume > 0 || p.isUs);
  const quiet = view.board.filter((p) => p.volume === 0 && !p.isUs).map((p) => p.name);
  return (
    <section className="mt-5 rounded-xl border border-border p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide">Share of G$ by day</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-1.5 pr-2">Day</th>
              <th className="py-1.5 pr-2 text-right">All projects G$</th>
              {cols.map((p) => <th key={p.name} className={cn("py-1.5 pr-2 text-right", p.isUs && "text-foreground")}>{p.name}</th>)}
              <th className="py-1.5 text-right" aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {[...view.days].reverse().map((d) => (
              <tr key={d.day} className="border-t border-border">
                <td className="whitespace-nowrap py-1.5 pr-2 font-semibold">{dayLabel(d.day)}{d.complete ? "" : <span className="ml-1 text-muted-foreground">(so far)</span>}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{fmtG(d.listed)}</td>
                {cols.map((p) => {
                  const s = d.shares.get(p.name) ?? 0;
                  const lead = d.leader === p.name;
                  return (
                    <td key={p.name} className={cn("py-1.5 pr-2 text-right tabular-nums", p.isUs && "font-bold", s === 0 && "text-muted-foreground/50")}
                      title={`${p.name} on ${dayLabel(d.day)}: ${fmt(d.rows.find((r) => r.project === p.name)?.volume ?? 0)} G$, ${d.rows.find((r) => r.project === p.name)?.txs ?? 0} txs`}>
                      <span className={cn("rounded px-1.5 py-0.5", lead && "bg-yellow-soft font-bold text-ink")}>{s === 0 ? "–" : pct(s)}</span>
                    </td>
                  );
                })}
                <td className="py-1.5 text-right">
                  <button type="button" disabled={busy} onClick={() => onRecompute(d.day)} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label={`Re-read ${dayLabel(d.day)}`} title="Re-read this day from Celo">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Highlighted = that day&apos;s top project. Hover a cell for G$ and transactions.{quiet.length ? ` No G$ yet: ${quiet.join(", ")}.` : ""} Today ({dayLabel(today)}) fills in as you press Update today; yesterday is finalised automatically just after midnight.
      </p>
    </section>
  );
}

// ── The project list ──────────────────────────────────────────────────────────

function Projects({ projects, onChanged }: { projects: ShareProject[]; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ name: string; addresses: string; isUs: boolean; isNew: boolean } | null>(null);
  const [msg, setMsg] = useState("");
  const save = async () => {
    if (!editing) return;
    setMsg("");
    try {
      await adminFetch("/api/dashboard/ecosystem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-project", name: editing.name, addresses: editing.addresses.split(/[\s,]+/).filter(Boolean), isUs: editing.isUs }),
      });
      setEditing(null);
      setMsg("Saved. Re-read the days to apply it to past days.");
      await onChanged();
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  };
  const remove = async (name: string) => {
    try {
      await adminFetch("/api/dashboard/ecosystem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-project", name }) });
      await onChanged();
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <section className="mt-5 rounded-xl border border-border p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between text-left">
        <h2 className="text-sm font-extrabold uppercase tracking-wide">Projects and contracts ({projects.length})</h2>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Edit"}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-2">
          {projects.map((p) => (
            <div key={p.name} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-bold">{p.name}{p.isUs ? <span className="ml-2 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] text-green-700">us</span> : null}</p>
                <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">{p.addresses.join(" · ")}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" className="font-semibold underline" onClick={() => setEditing({ name: p.name, addresses: p.addresses.join("\n"), isUs: p.isUs, isNew: false })}>Edit</button>
                <button type="button" aria-label={`Remove ${p.name}`} className="text-muted-foreground hover:text-rose-600" onClick={() => void remove(p.name)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {editing ? (
            <div className="space-y-2 rounded-lg border border-foreground/30 p-3">
              <label className="block text-xs font-semibold" htmlFor="eco-name">Project name</label>
              <input id="eco-name" value={editing.name} disabled={!editing.isNew} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-60" />
              <label className="block text-xs font-semibold" htmlFor="eco-addr">Contract addresses (one per line)</label>
              <textarea id="eco-addr" rows={4} value={editing.addresses} onChange={(e) => setEditing({ ...editing, addresses: e.target.value })} className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs" />
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={editing.isUs} onChange={(e) => setEditing({ ...editing, isUs: e.target.checked })} /> This is us (highlighted)</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => void save()} className="rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background">Save</button>
                <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing({ name: "", addresses: "", isUs: false, isNew: true })} className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <Plus className="h-4 w-4" /> Add a project
            </button>
          )}
          {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

// ── On-chain sustainability (RewardVault v3) ───────────────────────────────────

function SustainabilityPanel({ s }: { s: Sustainability | null }) {
  if (!s) {
    return (
      <section className="mt-5 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        <b className="text-foreground">On-chain sustainability</b> appears here once the RewardVault v3 upgrade is live.
      </section>
    );
  }
  const player = s.playerForfeits + s.playerPurchases;
  return (
    <section className="mt-5 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide">Rewards funded by players (on-chain)</h2>
        <span className="text-[11px] text-muted-foreground">RewardVault.sustainability(G$) · since the v3 upgrade</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Player-funded" value={`${s.playerFundedPct.toFixed(1)}%`} sub="of all money into the reward pot" tone={s.playerFundedPct >= 60 ? "good" : undefined} />
        <Tile label="From missed stakes" value={`${fmtG(s.playerForfeits)} G$`} sub="players' forfeits, after Delulu's cut" />
        <Tile label="From player purchases" value={`${fmtG(s.playerPurchases)} G$`} sub="streak freezes, cheers' pot cut" />
        <Tile label="Team top-ups" value={`${fmtG(s.team)} G$`} sub={s.sponsor ? `+ ${fmtG(s.sponsor)} G$ from sponsors` : "goal: 0"} tone={s.team > player ? "bad" : undefined} />
        <Tile label="Rolled over" value={`${fmtG(s.rolledOver)} G$`} sub="rewards restaked, never left" />
        <Tile label="Delulu revenue" value={`${fmtG(s.deluluRevenue)} G$`} sub={`${fmtG(s.granted)} G$ granted as rewards`} />
      </div>
    </section>
  );
}
