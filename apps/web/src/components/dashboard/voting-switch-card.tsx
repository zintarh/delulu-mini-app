"use client";

import { useEffect, useState } from "react";
import { Loader2, Vote } from "lucide-react";
import { cn } from "@/lib/utils";

type Setting = { enabled: boolean; updatedAt: string | null; updatedBy: string | null; stored: boolean };

/**
 * Admin → Home: turns the "Vote for Delulu" popup on or off for everyone.
 * Off also drops the vote gate before actions, the Home vote card and the
 * vote nudges. Players pick it up within about a minute, or when they come
 * back to the app.
 */
export function VotingSwitchCard() {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/dashboard/app-settings", { credentials: "include" })
      .then(async (r) => {
        const json = (await r.json().catch(() => ({}))) as { flowVote?: Setting; error?: string };
        if (cancelled) return;
        if (!r.ok || !json.flowVote) setError(json.error ?? "Couldn't load the voting switch.");
        else setSetting(json.flowVote);
      })
      .catch(() => !cancelled && setError("Couldn't load the voting switch."));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async () => {
    if (!setting || saving) return;
    const next = !setting.enabled;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/dashboard/app-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flowVote: next }),
      });
      const json = (await r.json().catch(() => ({}))) as { flowVote?: Setting; error?: string };
      if (!r.ok || !json.flowVote) throw new Error(json.error ?? "Couldn't save.");
      setSetting(json.flowVote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const on = setting?.enabled ?? false;

  return (
    <div className="mb-4 flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", on ? "bg-emerald-50 text-emerald-600" : "bg-muted text-muted-foreground")}>
        <Vote className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-bold text-foreground">Voting popup</p>
        <p className="m-0 text-xs text-muted-foreground">
          {error
            ? <span className="text-red-600">{error}</span>
            : !setting
              ? "Loading…"
              : on
                ? "On: players see the Vote for Delulu popup."
                : "Off: no vote popup, card or reminders."}
          {setting?.updatedBy && !error ? ` · changed by ${setting.updatedBy}${setting.updatedAt ? ` ${new Date(setting.updatedAt).toLocaleString()}` : ""}` : null}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Voting popup"
        onClick={() => void toggle()}
        disabled={!setting || saving}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
          on ? "bg-emerald-500" : "bg-muted-foreground/30",
        )}
      >
        <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform", on ? "translate-x-6" : "translate-x-1")}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : null}
        </span>
      </button>
    </div>
  );
}
