import { DeluluState } from "@/hooks/use-delulu-state";
import { cn } from "@/lib/utils";

interface DeluluStatusBadgeProps {
  state: DeluluState | null;
  isResolved?: boolean;
  isCancelled?: boolean;
  className?: string;
}

export function DeluluStatusBadge({
  state,
  isResolved,
  isCancelled,
  className,
}: DeluluStatusBadgeProps) {
  if (isCancelled || state === DeluluState.Cancelled) {
    return (
      <div
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-bold",
          className
        )}
      >
        Cancelled
      </div>
    );
  }

  if (isResolved || state === DeluluState.Resolved) {
    return (
      <div
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full bg-delulu-green/20 text-delulu-green text-xs font-bold",
          className
        )}
      >
        Resolved
      </div>
    );
  }

  if (state === DeluluState.StakingClosed) {
    return (
      <div
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full bg-delulu-purple/20 text-delulu-purple text-xs font-bold",
          className
        )}
      >
        Staking Closed
      </div>
    );
  }

  if (state === DeluluState.Active) {
    return (
      <div
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full bg-delulu-yellow/50 text-delulu-dark text-xs font-bold",
          className
        )}
      >
        Active
      </div>
    );
  }

  return null;
}

