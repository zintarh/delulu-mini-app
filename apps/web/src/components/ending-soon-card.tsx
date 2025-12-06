"use client";

import { FormattedDelulu } from "@/hooks/use-delulus";
import { formatTimeRemaining } from "@/lib/utils";
import { cn } from "@/lib/utils";



interface EndingSoonCardProps {
  delulu: FormattedDelulu;
  onClick: () => void;
  className?: string;
}

export function EndingSoonCard({ 
  delulu, 
  onClick,
  className = "shrink-0 w-[85%] sm:w-[400px]"
}: EndingSoonCardProps) {
  const content = delulu.content || delulu.contentHash;
  const truncatedContent = content.length > 80 ? content.slice(0, 80) + "..." : content;

  return (
    <button
      onClick={onClick}
      className={cn(
        className,
        "block p-4 rounded-2xl bg-white/5 active:scale-[0.98] transition-transform text-left border border-white/10"
      )}
    >
      {/* Content */}
      <p className="text-sm text-white/90 mb-3 leading-relaxed line-clamp-2">
        {truncatedContent}
      </p>

      {/* Time Remaining - Prominent */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/60">Ends in</span>
          <span className="text-sm font-bold text-delulu-yellow">
            {formatTimeRemaining(delulu.stakingDeadline)}
          </span>
        </div>
        <span className="text-xs text-white/40">
          {delulu.totalStake > 0
            ? delulu.totalStake < 0.01
              ? delulu.totalStake.toFixed(2)
              : delulu.totalStake.toFixed(0)
            : "0"}
          cUSD
        </span>
      </div>
    </button>
  );
}

