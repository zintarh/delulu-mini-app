"use client";

import { FormattedDelulu } from "@/hooks/use-delulus";
import { formatTimeRemaining, cn, getCountryFlag } from "@/lib/utils";



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
        "block p-3 rounded-xl bg-black active:scale-[0.98] transition-transform text-left border border-white/10 relative"
      )}
    >
      {/* Gatekeeper Badge */}
      {delulu.gatekeeper?.enabled && (
        <div className="absolute top-2 right-2 z-10">
          <div className="px-1.5 py-0.5 rounded-full bg-black/20 border border-black/30 backdrop-blur-sm flex items-center justify-center">
            <span className="text-sm">
              {getCountryFlag(delulu.gatekeeper.value)}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <p className="text-xs text-white mb-2 leading-relaxed line-clamp-2">
        {truncatedContent}
      </p>

      {/* Time Remaining - Prominent */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-white/60">Ends in</span>
          <span className="text-xs font-bold text-white">
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

