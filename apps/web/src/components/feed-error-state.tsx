"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}

export function FeedErrorState({
  title = "Couldn't load content",
  message = "Check your connection and try again.",
  onRetry,
  isRetrying = false,
  className,
}: FeedErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-4 py-16 text-center",
        className,
      )}
      role="alert"
    >
      <AlertCircle className="h-10 w-10 text-muted-foreground/40" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-1 inline-flex items-center gap-2 rounded-full bg-delulu-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-delulu-blue/90 disabled:opacity-60"
        >
          <RefreshCw
            className={cn("h-4 w-4", isRetrying && "animate-spin")}
            aria-hidden
          />
          {isRetrying ? "Retrying…" : "Try again"}
        </button>
      ) : null}
    </div>
  );
}
