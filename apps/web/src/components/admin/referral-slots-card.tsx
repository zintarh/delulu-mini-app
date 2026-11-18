"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/components/admin/reward-engine-ui";
import { cn } from "@/lib/utils";

type Round = { start: string; end: string; reward: number; defaultSlots: number; slots: number; used: number };

const day = (iso: string, endExclusive = false) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" }).format(new Date(Date.parse(iso) - (endExclusive ? 1 : 0)));

/**
 * Admin: how many friends each 2-week referral round can credit. Referrers see
 * "N of M spots left"; when they're taken, nothing more is credited (or paid)
 * until the next round. Spots × reward = that round's most it can cost.
 */
export function ReferralSlotsCard() {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRounds((await adminFetch<{ rounds: Round[] }>("/api/dashboard/referrals/slots")).rounds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (r: Round) => {
    const slots = Number(draft[r.start]);
    setSaving(r.start);
    setError(null);
    try {
      const res = await adminFetch<{ rounds: Round[] }>("/api/dashboard/referrals/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundStart: r.start, slots }),
      });
      setRounds(res.rounds);
      setDraft((d) => {
        const { [r.start]: _drop, ...rest } = d;
        return rest;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  };

  const now = Date.now();
  return (
    <section className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-extrabold text-foreground">Referral spots per round</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Your acquisition target for each weekly round — two per 2-week epoch, ending on demo day. Referrers see the spots left; once they&apos;re taken, nothing more is credited until the next round.
      </p>
      {error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p> : null}
      <div className="mt-3 flex flex-col gap-2">
        {(rounds ?? []).map((r, i) => {
          // Two weekly rounds per epoch; the epoch ends on its Tuesday demo day.
          const epoch = Math.floor(i / 2);
          const pair = (rounds ?? []).slice(epoch * 2, epoch * 2 + 2);
          const demoDay = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" }).format(
            new Date(Date.parse(pair[pair.length - 1].end) - 1),
          );
          const header =
            i % 2 === 0 ? (
              <p key={`epoch-${epoch}`} className={cn("text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground", i > 0 && "mt-3")}>
                Epoch {epoch + 1} · demo day {demoDay} · {pair.reduce((n, x) => n + x.used, 0)} of {pair.reduce((n, x) => n + x.slots, 0)} spots taken
              </p>
            ) : null;
          const live = now >= Date.parse(r.start) && now < Date.parse(r.end);
          const past = now >= Date.parse(r.end);
          const value = draft[r.start] ?? String(r.slots);
          const changed = draft[r.start] != null && Number(draft[r.start]) !== r.slots;
          const pct = r.slots > 0 ? Math.min(100, Math.round((r.used / r.slots) * 100)) : 0;
          return [
            header,
            <div key={r.start} className={cn("grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border px-3 py-2.5", live ? "border-foreground" : "border-border", past && "opacity-60")}>
              <div className="min-w-0">
                <p className="text-sm font-bold">
                  {day(r.start)} – {day(r.end, true)} {live ? <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">now</span> : null}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                    <span className={cn("block h-full", pct >= 100 ? "bg-red-500" : "bg-foreground")} style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.used} of {r.slots} taken · up to {(r.slots * r.reward).toLocaleString("en-US")} G$
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={value}
                  disabled={past}
                  onChange={(e) => setDraft((d) => ({ ...d, [r.start]: e.target.value }))}
                  className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-sm font-bold tabular-nums"
                  aria-label={`Spots for ${day(r.start)}`}
                />
                <button
                  type="button"
                  onClick={() => void save(r)}
                  disabled={!changed || saving === r.start || past}
                  className="h-9 rounded-lg bg-foreground px-3 text-xs font-bold text-background disabled:opacity-40"
                >
                  {saving === r.start ? "Saving…" : "Save"}
                </button>
              </div>
            </div>,
          ];
        })}
      </div>
    </section>
  );
}
