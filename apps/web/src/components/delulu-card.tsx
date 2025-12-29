"use client";

import { FormattedDelulu } from "@/hooks/use-delulus";
import { formatTimeRemaining, formatTimeAgo, cn } from "@/lib/utils";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface DeluluCardProps {
  delusion: FormattedDelulu;
  onClick: () => void;
  className?: string;
}

export function DeluluCard({ 
  delusion, 
  onClick,
  className = ""
}: DeluluCardProps) {
  const total = delusion.totalBelieverStake + delusion.totalDoubterStake;
  const believerPercent =
    total > 0 ? Math.round((delusion.totalBelieverStake / total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        className,
        "block p-4 rounded-2xl active:scale-[0.98] transition-transform text-left relative h-auto"
      )}
    >
      {/* Gatekeeper Badge */}
      {delusion.gatekeeper?.enabled && (
        <div className="absolute top-3 right-3 z-10">
          <div className="px-2 py-1 rounded-full bg-white/20 border border-white/30 backdrop-blur-sm">
            <span className="text-[10px] font-bold text-white">
              {delusion.gatekeeper.label || delusion.gatekeeper.value}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        {delusion.pfpUrl ? (
          <img
            src={delusion.pfpUrl}
            alt={delusion.username || delusion.creator}
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">
              {formatAddress(delusion.creator).slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">
              {delusion.username ? `@${delusion.username}` : formatAddress(delusion.creator)}
            </span>
            <span className="text-xs text-white/50">·</span>
            <span className="text-xs text-white/50">
              {formatTimeAgo(
                delusion.createdAt || new Date(delusion.stakingDeadline.getTime() - 7 * 24 * 60 * 60 * 1000)
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-white mb-4 leading-relaxed break-words whitespace-pre-wrap">
        {delusion.content || delusion.contentHash}
      </p>

      {/* Staking Deadline */}
      <div className="mb-3">
        <p className="text-xs text-white/60">
          Staking closes in{" "}
          <span className="text-white font-bold">
            {formatTimeRemaining(delusion.stakingDeadline)}
          </span>
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 mb-3">
        <div className="flex items-center gap-1 text-white/60">
          <span className="text-delulu-purple font-black text-sm">
            {delusion.totalStake > 0
              ? delusion.totalStake < 0.01
                ? delusion.totalStake.toFixed(4)
                : delusion.totalStake.toFixed(2)
              : "0.00"}
          </span>
          <span className="text-xs">cUSD</span>
        </div>
        <div className="flex items-center gap-1 text-white/60">
          <span className="text-sm font-bold">{believerPercent}%</span>
          <span className="text-xs">believe</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-800">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="flex items-center gap-2 text-white/60 hover:text-delulu-green transition-colors"
        >
          <span className="text-xs font-bold">Believe</span>
          <span className="text-xs text-white/50">
            {delusion.totalBelieverStake > 0
              ? delusion.totalBelieverStake < 0.01
                ? delusion.totalBelieverStake.toFixed(4)
                : delusion.totalBelieverStake.toFixed(2)
              : "0.00"}
          </span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="flex items-center gap-2 text-white/60 hover:text-delulu-purple transition-colors"
        >
          <span className="text-xs font-bold">Doubt</span>
          <span className="text-xs text-white/50">
            {delusion.totalDoubterStake > 0
              ? delusion.totalDoubterStake < 0.01
                ? delusion.totalDoubterStake.toFixed(4)
                : delusion.totalDoubterStake.toFixed(2)
              : "0.00"}
          </span>
        </button>
      </div>
    </button>
  );
}
