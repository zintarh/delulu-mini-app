"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/components/admin/reward-engine-ui";
import type { GdScorecard, ScoreRow, ScoreStatus } from "@/lib/analytics/gd-scorecard";
import { cn } from "@/lib/utils";

const STATUS: Record<ScoreStatus, { label: string; className: string }> = {
  tracked: { label: "Tracked", className: "bg-green-100 text-green-800" },
  estimate: { label: "Estimate", className: "bg-amber-100 text-amber-800" },
  missing: { label: "Not tracked yet", className: "bg-muted text-muted-foreground" },
};

function Row({ r }: { r: ScoreRow }) {
  const s = STATUS[r.status];
  return (
    <li className="grid gap-x-4 gap-y-1 border-t border-border py-3 first:border-t-0 first:pt-0 sm:grid-cols-[1.3fr_1fr_1fr]">
      <div className="min-w-0">
        <p className="text-sm font-extrabold">{r.metric}</p>
        <p className="text-xs text-muted-foreground">{r.definition}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Last season</p>
        <p className="text-xs font-semibold">{r.benchmark ?? "—"}</p>
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Delulu now <span className={cn("rounded-full px-1.5 py-px text-[9px] font-bold normal-case tracking-normal", s.className)}>{s.label}</span>
        </p>
        <p className={cn("text-base font-extrabold tabular-nums", r.tone === "good" && "text-green-700", r.tone === "bad" && "text-red-700")}>{r.ours ?? "—"}</p>
        <p className="text-[11px] text-muted-foreground">{r.note}</p>
      </div>
    </li>
  );
}

/**
 * What GoodDollar measures each team on this season, next to our own number —
 * so we always know what we're working against.
 */
export function GdScorecardPanel({ reloadKey }: { reloadKey: number }) {
  const [data, setData] = useState<GdScorecard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    adminFetch<GdScorecard>("/api/dashboard/season/scorecard")
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      live = false;
    };
  }, [reloadKey]);

  return (
    <section className="mb-5 rounded-2xl border border-foreground bg-card p-4 shadow-sm">
      <p className="text-sm font-extrabold">What GoodDollar measures us on</p>
      <p className="mb-3 text-xs text-muted-foreground">
        GoodBuilders definitions from the S4 dashboard. Season 5 judges usage, sustainability and community, on one shared dashboard. Our figures are this season so far.
      </p>
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {!data && !error ? <div className="h-48 animate-pulse rounded-xl bg-muted" /> : null}
      {data ? (
        <div className="grid gap-3 xl:grid-cols-3">
          {data.groups.map((g) => (
            <div key={g.key} className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide">{g.title}</p>
              <p className="mb-3 text-[11px] text-muted-foreground">{g.focus}</p>
              <ul className="flex flex-col">
                {g.rows.map((r) => (
                  <Row key={r.key} r={r} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
