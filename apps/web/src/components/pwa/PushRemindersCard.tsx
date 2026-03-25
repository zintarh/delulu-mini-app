"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getPushSupportState,
  subscribeToWebPush,
  unsubscribeWebPush,
  type PushSupportState,
} from "@/lib/web-push-client";

export function PushRemindersCard({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { address, isConnected } = useAccount();
  const [support, setSupport] = useState<PushSupportState | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPushSupportState()
      .then((s) => {
        if (!cancelled) setSupport(s);
      })
      .catch(() => {
        if (!cancelled) setSupport({ state: "unsupported" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isSupported = support?.state !== "unsupported";
  const subscribed =
    support?.state === "ready" ? support.subscribed : false;

  const label = useMemo(() => {
    if (!isSupported) return "Reminders not supported";
    if (!isConnected) return "Sign in to enable reminders";
    if (subscribed) return "Reminders enabled";
    return "Enable reminders";
  }, [isSupported, isConnected, subscribed]);

  const onToggle = async () => {
    if (!isSupported) return;
    if (!isConnected || !address) return;

    setIsWorking(true);
    setError(null);
    try {
      if (subscribed) {
        await unsubscribeWebPush(address);
      } else {
        await subscribeToWebPush(address);
      }
      const next = await getPushSupportState();
      setSupport(next);
    } catch (e: any) {
      setError(e?.message || "Failed to update reminders.");
    } finally {
      setIsWorking(false);
    }
  };

  const icon = subscribed ? Bell : BellOff;
  const Icon = icon;

  if (support === null) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground",
          className,
        )}
      >
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking reminders…
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        compact
          ? "rounded-lg border border-border bg-background/70 px-3 py-2"
          : "rounded-2xl border border-border bg-card p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-delulu-yellow-reserved" />
            <p className={cn("font-bold", compact ? "text-xs" : "text-sm")}>
              Proof reminders
            </p>
          </div>
          {!compact && (
            <p className="mt-1 text-xs text-muted-foreground">
              We’ll notify you 30 minutes before proof is due and 30 minutes
              before your delulu ends.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          disabled={!isSupported || !isConnected || isWorking}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold transition-colors",
            subscribed
              ? "bg-muted/60 hover:bg-muted"
              : "bg-delulu-yellow-reserved text-delulu-charcoal hover:bg-delulu-yellow-reserved/90",
            (!isSupported || !isConnected || isWorking) &&
              "opacity-60 cursor-not-allowed",
          )}
        >
          {isWorking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <span>{subscribed ? "Disable" : "Enable"}</span>
        </button>
      </div>

      {compact ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
      ) : null}

      {error ? (
        <p className="mt-2 text-[11px] text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

