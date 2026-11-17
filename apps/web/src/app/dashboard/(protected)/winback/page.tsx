"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Mail, RefreshCw, Search, Send, Sparkles } from "lucide-react";
import {
  DashboardField,
  DashboardModal,
  DashboardPage,
  DashboardStat,
  DashboardStatGrid,
  dashboardInputClass,
  useDashboardToast,
} from "@/components/dashboard/dashboard-ui";
import { DashboardSectionTabs, OUTREACH_SECTION_TABS } from "@/components/dashboard/dashboard-section-tabs";
import { adminFetch } from "@/components/admin/reward-engine-ui";
import { Coin, Flame, Lulu } from "@/components/ds";
import type { WinbackDto } from "@/app/api/dashboard/winback/route";
import type { WinbackSendResult } from "@/app/api/dashboard/winback/send/route";
import type { OutreachPerson } from "@/lib/outreach/activity";
import { buildLuluEmailHtml } from "@/lib/outreach/email";
import {
  OUTREACH_TEMPLATES,
  fillTemplate,
  findBlanks,
  formatEarned,
  formatLastActive,
  usesEarned,
} from "@/lib/outreach/templates";
import { cn } from "@/lib/utils";

type DaysFilter = "any" | "7" | "10" | "11";
const DAYS_OPTIONS: { id: DaysFilter; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "7", label: "7+ days" },
  { id: "10", label: "10+ days" },
  { id: "11", label: "More than 10" },
];

type Toggle = "paid" | "unpaid" | "quiet" | "hasEmail" | "notEmailed";
const TOGGLES: { id: Toggle; label: string }[] = [
  { id: "paid", label: "Rewarded before" },
  { id: "unpaid", label: "Never rewarded" },
  { id: "quiet", label: "Gone quiet 14+ days" },
  { id: "hasEmail", label: "Has email" },
  { id: "notEmailed", label: "Not emailed yet" },
];

const CTA_LINKS = [
  { path: "/home", label: "Home" },
  { path: "/leaderboard", label: "Leaderboard" },
  { path: "/rewards", label: "Rewards" },
  { path: "/explore", label: "Campaigns" },
];

const MERGE_TAGS = ["{name}", "{days}", "{earned}", "{lastActive}"];

const daysSince = (day: string) => Math.floor((Date.now() - new Date(`${day}T12:00:00Z`).getTime()) / 86_400_000);
const fmt = (n: number) => n.toLocaleString("en-US");

function ago(iso: string | null): string {
  if (!iso) return "—";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-colors",
        on ? "border-ink bg-yellow text-ink shadow-[0_2px_0_#161615]" : "border-line bg-white text-muted-foreground hover:border-ink/40",
      )}
    >
      {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      {children}
    </button>
  );
}

function DaysBar({ days, max }: { days: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-right font-display text-lg font-extrabold tabular-nums">{days}</span>
      <span className="hidden h-2 w-20 overflow-hidden rounded-full bg-line sm:block" aria-hidden>
        <span className="block h-full rounded-full bg-yellow" style={{ width: `${Math.max(6, Math.min(100, (days / max) * 100))}%` }} />
      </span>
    </div>
  );
}

/**
 * Outreach → Win back. Everyone who ever proved a goal, how consistent they
 * were and what Delulu has paid them — filter them, pick a Lulu template,
 * preview it with a real person's numbers and send.
 */
export default function WinbackPage() {
  const { show: toast } = useDashboardToast();
  const [data, setData] = useState<WinbackDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [days, setDays] = useState<DaysFilter>("7");
  const [toggles, setToggles] = useState<Set<Toggle>>(new Set(["hasEmail"]));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [templateId, setTemplateId] = useState(OUTREACH_TEMPLATES[0].id);
  const [draft, setDraft] = useState(() => ({ ...OUTREACH_TEMPLATES[0] }));
  const [includeRecent, setIncludeRecent] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState<"test" | "all" | null>(null);
  const [lastResult, setLastResult] = useState<WinbackSendResult | null>(null);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminFetch<WinbackDto>(`/api/dashboard/winback${fresh ? "?fresh=1" : ""}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const people = useMemo(() => data?.people ?? [], [data]);
  const maxDays = Math.max(1, ...people.map((p) => p.activeDays));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = days === "any" ? 1 : Number(days);
    return people.filter((p) => {
      if (p.activeDays < min) return false;
      const paid = p.earnedGd > 0 || p.earnedUsdt > 0 || p.rewardSources.length > 0;
      if (toggles.has("paid") && !paid) return false;
      if (toggles.has("unpaid") && paid) return false;
      if (toggles.has("quiet") && daysSince(p.lastActive) < 14) return false;
      if (toggles.has("hasEmail") && !p.email) return false;
      if (toggles.has("notEmailed") && p.lastEmailedAt) return false;
      if (q && !`${p.username ?? ""} ${p.email ?? ""} ${p.wallet}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [people, days, toggles, query]);

  const stats = useMemo(() => {
    const paid = people.filter((p) => p.earnedGd > 0 || p.earnedUsdt > 0 || p.rewardSources.length > 0);
    return {
      total: people.length,
      sevenPlus: people.filter((p) => p.activeDays >= 7).length,
      paidQuiet: paid.filter((p) => p.activeDays >= 7 && daysSince(p.lastActive) >= 14).length,
      emailed: people.filter((p) => p.lastEmailedAt).length,
    };
  }, [people]);

  const flip = (t: Toggle) =>
    setToggles((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else {
        next.add(t);
        if (t === "paid") next.delete("unpaid");
        if (t === "unpaid") next.delete("paid");
      }
      return next;
    });

  const recipients = useMemo(() => people.filter((p) => selected.has(p.wallet)), [people, selected]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.wallet));
  const toggleAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((p) => next.delete(p.wallet));
      else filtered.forEach((p) => next.add(p.wallet));
      return next;
    });
  const toggleOne = (w: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });

  const pickTemplate = (id: string) => {
    const t = OUTREACH_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setTemplateId(id);
    setDraft({ ...t });
  };

  const sample: OutreachPerson | undefined = recipients[0] ?? filtered[0];
  const merge = sample
    ? {
        name: sample.username || "dreamer",
        days: sample.activeDays,
        earned: formatEarned(sample.earnedGd, sample.earnedUsdt),
        lastActive: formatLastActive(sample.lastActive),
      }
    : { name: "dreamer", days: 12, earned: "45,000 G$", lastActive: "August" };

  const previewHtml = useMemo(
    () =>
      buildLuluEmailHtml({
        appUrl: typeof window !== "undefined" ? window.location.origin : "https://www.staydelulu.xyz",
        subject: fillTemplate(draft.subject, merge),
        heading: fillTemplate(draft.heading || "Hey {name} 👋", merge),
        body: fillTemplate(draft.body || "Your message will appear here.", merge),
        cta: fillTemplate(draft.cta || "Open Delulu", merge),
        ctaPath: draft.ctaPath,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, merge.name, merge.days, merge.earned, merge.lastActive],
  );

  const blanks = findBlanks(draft.subject, draft.heading, draft.body, draft.cta);
  const recentCut = Date.now() - 3 * 86_400_000;
  const noEmail = recipients.filter((p) => !p.email).length;
  const recent = recipients.filter((p) => p.email && p.lastEmailedAt && new Date(p.lastEmailedAt).getTime() > recentCut).length;
  const unpaidWithEarned = usesEarned(draft.subject, draft.body, draft.heading) ? recipients.filter((p) => !(p.earnedGd > 0 || p.earnedUsdt > 0)).length : 0;
  const willSend = recipients.length - noEmail - (includeRecent ? 0 : recent);
  const canSend = recipients.length > 0 && draft.subject.trim() && draft.body.trim() && blanks.length === 0;

  const send = async (test: boolean) => {
    setSending(test ? "test" : "all");
    try {
      const res = await adminFetch<WinbackSendResult & { to?: string }>("/api/dashboard/winback/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallets: recipients.map((p) => p.wallet), templateId, ...draft, test, includeRecent }),
      });
      if (test) toast(`Test sent to ${res.to}`);
      else {
        setLastResult(res);
        setConfirmOpen(false);
        toast(`Sent to ${res.sent} ${res.sent === 1 ? "person" : "people"}`);
        setSelected(new Set());
        await load(true);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(null);
    }
  };

  const insertTag = (tag: string) => setDraft((d) => ({ ...d, body: `${d.body}${d.body.endsWith(" ") || !d.body ? "" : " "}${tag}` }));

  return (
    <DashboardPage className="max-w-none px-5 pb-16 sm:px-7">
      <DashboardSectionTabs items={OUTREACH_SECTION_TABS} />

      <div className="mb-5 mt-4 flex flex-wrap items-center gap-4">
        <Lulu size={64} mood="kept" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold text-foreground">Win back your dreamers</h2>
          <p className="text-sm text-muted-foreground">Everyone who ever proved a goal, how consistent they were and what Delulu paid them.</p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-bold hover:border-ink/40"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      ) : null}

      <DashboardStatGrid>
        <DashboardStat label="Ever proved" value={fmt(stats.total)} isLoading={loading && !data} />
        <DashboardStat label="7+ active days" value={fmt(stats.sevenPlus)} isLoading={loading && !data} />
        <DashboardStat label="Paid & gone quiet" value={fmt(stats.paidQuiet)} isLoading={loading && !data} />
        <DashboardStat label="Emailed" value={fmt(stats.emailed)} isLoading={loading && !data} />
      </DashboardStatGrid>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* People */}
        <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Active</span>
            {DAYS_OPTIONS.map((o) => (
              <Chip key={o.id} on={days === o.id} onClick={() => setDays(o.id)}>
                {o.label}
              </Chip>
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {TOGGLES.map((t) => (
              <Chip key={t.id} on={toggles.has(t.id)} onClick={() => flip(t.id)}>
                {t.label}
              </Chip>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Search people</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input className={cn(dashboardInputClass, "pl-9")} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" />
            </label>
            <span className="text-sm font-semibold text-muted-foreground">
              {fmt(filtered.length)} people · <span className="text-foreground">{fmt(selected.size)} selected</span>
            </span>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/60 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" aria-label="Select everyone shown" checked={allFilteredSelected} onChange={toggleAllFiltered} className="h-4 w-4 accent-[#f6c324]" />
                  </th>
                  <th className="px-3 py-2.5">Person</th>
                  <th className="px-3 py-2.5">Active days</th>
                  <th className="px-3 py-2.5">Last active</th>
                  <th className="px-3 py-2.5">Rewarded</th>
                  <th className="px-3 py-2.5">Emailed</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-t border-border">
                        <td colSpan={6} className="px-3 py-3">
                          <div className="h-6 animate-pulse rounded-lg bg-muted" />
                        </td>
                      </tr>
                    ))
                  : filtered.map((p) => {
                      const quiet = daysSince(p.lastActive);
                      const on = selected.has(p.wallet);
                      return (
                        <tr
                          key={p.wallet}
                          onClick={() => toggleOne(p.wallet)}
                          className={cn("cursor-pointer border-t border-border transition-colors", on ? "bg-yellow-soft" : "hover:bg-muted/40")}
                        >
                          <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" aria-label={`Select ${p.username ?? p.email ?? p.wallet}`} checked={on} onChange={() => toggleOne(p.wallet)} className="h-4 w-4 accent-[#f6c324]" />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-yellow-soft text-xs font-extrabold">
                                {(p.username ?? p.email ?? "?").charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <div className="truncate font-bold">{p.username ? `@${p.username}` : <span className="text-muted-foreground">No username</span>}</div>
                                <div className="truncate text-xs text-muted-foreground">{p.email ?? "no email"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <DaysBar days={p.activeDays} max={maxDays} />
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={cn("inline-flex items-center gap-1 text-xs font-bold", quiet <= 2 ? "text-green-edge" : quiet >= 30 ? "text-orange" : "text-foreground")}>
                              {quiet <= 2 ? <Flame size={14} /> : null}
                              {formatLastActive(p.lastActive)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {p.earnedGd > 0 || p.earnedUsdt > 0 ? (
                              <div>
                                <span className="inline-flex items-center gap-0.5 font-extrabold text-green-edge">
                                  <Coin size={14} />
                                  {formatEarned(p.earnedGd, p.earnedUsdt)}
                                </span>
                                <div className="text-[11px] text-muted-foreground">{p.rewardSources.join(" · ")}</div>
                              </div>
                            ) : p.rewardSources.length > 0 ? (
                              <span className="text-xs text-muted-foreground">{p.rewardSources.join(" · ")}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">{ago(p.lastEmailedAt)}</td>
                        </tr>
                      );
                    })}
                {data && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      Nobody matches these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {/* Composer */}
        <section className="rounded-2xl border-2 border-ink bg-card p-4 shadow-[0_5px_0_#161615] sm:p-5 xl:sticky xl:top-4 xl:self-start">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <h3 className="text-sm font-extrabold">Write as Lulu</h3>
            <span className="ml-auto rounded-full bg-yellow-soft px-2.5 py-1 text-xs font-bold">{fmt(recipients.length)} selected</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {OUTREACH_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTemplate(t.id)}
                aria-pressed={templateId === t.id}
                className={cn(
                  "rounded-xl border-2 px-3 py-2 text-left transition-colors",
                  templateId === t.id ? "border-ink bg-yellow-soft" : "border-line bg-white hover:border-ink/40",
                )}
              >
                <div className="text-xs font-extrabold">{t.label}</div>
                <div className="text-[11px] text-muted-foreground">{t.bestFor}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <DashboardField label="Subject">
              <input className={dashboardInputClass} value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} placeholder="Lulu misses you" />
            </DashboardField>
            <DashboardField label="Heading">
              <input className={dashboardInputClass} value={draft.heading} onChange={(e) => setDraft((d) => ({ ...d, heading: e.target.value }))} />
            </DashboardField>
            <DashboardField label="Message">
              <textarea
                className={cn(dashboardInputClass, "min-h-[180px] resize-y leading-relaxed")}
                value={draft.body}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                placeholder="Write it like Lulu would: warm, short, a little cheeky."
              />
            </DashboardField>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">Insert:</span>
              {MERGE_TAGS.map((tag) => (
                <button key={tag} type="button" onClick={() => insertTag(tag)} className="rounded-md border border-line bg-white px-2 py-0.5 font-mono text-[11px] hover:border-ink/40">
                  {tag}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DashboardField label="Button text">
                <input className={dashboardInputClass} value={draft.cta} onChange={(e) => setDraft((d) => ({ ...d, cta: e.target.value }))} />
              </DashboardField>
              <DashboardField label="Button opens">
                <select className={dashboardInputClass} value={draft.ctaPath} onChange={(e) => setDraft((d) => ({ ...d, ctaPath: e.target.value }))}>
                  {CTA_LINKS.map((l) => (
                    <option key={l.path} value={l.path}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </DashboardField>
            </div>
          </div>

          {blanks.length > 0 ? (
            <p className="mt-3 rounded-lg bg-orange-soft px-3 py-2 text-xs font-semibold text-orange">Fill in {blanks.join(", ")} before sending.</p>
          ) : null}
          {unpaidWithEarned > 0 ? (
            <p className="mt-3 rounded-lg bg-orange-soft px-3 py-2 text-xs font-semibold text-orange">
              {unpaidWithEarned} selected {unpaidWithEarned === 1 ? "person was" : "people were"} never paid, so {"{earned}"} reads “some money” for them. Filter by “Rewarded before” for this template.
            </p>
          ) : null}

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Preview{sample ? ` · as @${sample.username ?? "dreamer"}` : ""}</span>
              <span className="truncate pl-2">{fillTemplate(draft.subject, merge)}</span>
            </div>
            <iframe title="Email preview" srcDoc={previewHtml} sandbox="" className="h-[420px] w-full rounded-xl border border-border bg-[#fdf1c7]" />
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <input type="checkbox" checked={includeRecent} onChange={(e) => setIncludeRecent(e.target.checked)} className="h-4 w-4 accent-[#f6c324]" />
            Also email people I emailed in the last 3 days ({recent})
          </label>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!canSend || sending !== null}
              onClick={() => void send(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-line bg-white px-3 py-2.5 text-sm font-bold disabled:opacity-50"
            >
              <Mail className="h-4 w-4" /> {sending === "test" ? "Sending…" : "Send me a test"}
            </button>
            <button
              type="button"
              disabled={!canSend || willSend <= 0 || sending !== null}
              onClick={() => setConfirmOpen(true)}
              className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-xl border-2 border-ink bg-yellow px-3 py-2.5 text-sm font-extrabold text-ink shadow-[0_3px_0_#161615] disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Send to {fmt(Math.max(0, willSend))}
            </button>
          </div>

          {lastResult ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Last send: <strong className="text-foreground">{lastResult.sent} sent</strong>
              {lastResult.failed ? `, ${lastResult.failed} failed` : ""}
              {lastResult.skippedRecent ? `, ${lastResult.skippedRecent} skipped (emailed recently)` : ""}
              {lastResult.skippedNoEmail ? `, ${lastResult.skippedNoEmail} without email` : ""}.
            </p>
          ) : null}
        </section>
      </div>

      <DashboardModal open={confirmOpen} onOpenChange={setConfirmOpen} title={`Send to ${fmt(willSend)} people?`} description={fillTemplate(draft.subject, merge)}>
        <div className="space-y-2 text-sm">
          <p>
            Each person gets their own name, active days and rewards filled in.
            {noEmail ? ` ${noEmail} without an email will be skipped.` : ""}
            {!includeRecent && recent ? ` ${recent} emailed in the last 3 days will be skipped.` : ""}
          </p>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-xl border-2 border-line px-4 py-2 text-sm font-bold">
              Not yet
            </button>
            <button
              type="button"
              disabled={sending !== null}
              onClick={() => void send(false)}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-yellow px-4 py-2 text-sm font-extrabold shadow-[0_3px_0_#161615] disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {sending === "all" ? "Sending…" : "Send it"}
            </button>
          </div>
        </div>
      </DashboardModal>
    </DashboardPage>
  );
}
