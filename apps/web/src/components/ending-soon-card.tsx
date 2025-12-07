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
  className = "shrink-0 w-[200px] sm:w-[240px]"
}: EndingSoonCardProps) {
  const content = delulu.content || delulu.contentHash;
  const truncatedContent = content.length > 60 ? content.slice(0, 60) + "..." : content;

  return (
    <button
      onClick={onClick}
      className={cn(
        className,
        "block p-3 rounded-xl bg-white/5 active:scale-[0.98] transition-transform text-left border border-white/10"
      )}
    >
      {/* Content */}
      <p className="text-xs text-white/90 mb-2 leading-relaxed line-clamp-2">
        {truncatedContent}
      </p>

      {/* Time Remaining - Prominent */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-white/60">Ends in</span>
          <span className="text-xs font-bold text-delulu-yellow">
            {formatTimeRemaining(delulu.stakingDeadline)}
          </span>
        </div>
        <span className="text-[10px] text-white/40">
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

