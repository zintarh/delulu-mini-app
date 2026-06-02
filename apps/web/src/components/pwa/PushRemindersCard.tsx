"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";
import { SIGN_IN_BUTTON_LABEL } from "@/lib/auth-redirect";
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
  const { address, authenticated } = useAuth();
  const { redirectToSignIn } = useRedirectToSignIn();
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
    if (!authenticated) return `${SIGN_IN_BUTTON_LABEL} to enable reminders`;
    if (subscribed) return "Reminders enabled";
    return "Enable reminders";
  }, [isSupported, authenticated, subscribed]);

  const onToggle = async () => {
    if (!isSupported) return;
    if (!authenticated) {
      redirectToSignIn();
      return;
    }
    if (!address) return;

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

  const buttonLabel = !authenticated
    ? SIGN_IN_BUTTON_LABEL
    : subscribed
      ? "Disable"
      : "Enable";

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
            <Icon className="h-4 w-4 text-blue-500" />
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
          disabled={(!isSupported || isWorking) && authenticated}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold transition-colors",
            subscribed
              ? "bg-secondary hover:bg-secondary/80"
              : "bg-delulu-yellow-reserved text-delulu-charcoal hover:bg-delulu-yellow-reserved/90",
            !authenticated && "hover:bg-delulu-yellow-reserved/90",
            ((!isSupported && authenticated) || isWorking) &&
              "opacity-60 cursor-not-allowed",
          )}
        >
          {isWorking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <span>{buttonLabel}</span>
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
