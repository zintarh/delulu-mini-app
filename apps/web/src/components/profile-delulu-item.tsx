"use client";

import { FormattedDelulu } from "@/hooks/use-delulus";
import { DeluluMenu } from "@/components/delulu-menu";
import { formatTimeRemaining } from "@/lib/utils";
import { useState } from "react";
import { ComingSoonSheet } from "@/components/coming-soon-sheet";

interface ProfileDeluluItemProps {
  delulu: FormattedDelulu;
  isCreator: boolean;
  onCancel?: () => void;
}

export function ProfileDeluluItem({
  delulu,
  isCreator,
  onCancel,
}: ProfileDeluluItemProps) {
  const [resolveSheetOpen, setResolveSheetOpen] = useState(false);

  const isEndingSoon = () => {
    const now = new Date();
    const deadline = delulu.stakingDeadline;
    const diff = deadline.getTime() - now.getTime();
    const hours = diff / (1000 * 60 * 60);
    return hours > 0 && hours <= 24;
  };

  return (
    <>
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-3 relative">
        {/* Gatekeeper Badge */}
        {delulu.gatekeeper?.enabled && (
          <div className="absolute top-3 right-3 z-10">
            <div className="px-2 py-1 rounded-full bg-delulu-yellow/20 border border-delulu-yellow/30 backdrop-blur-sm">
              <span className="text-[10px] font-bold text-delulu-yellow">
                {delulu.gatekeeper.label || delulu.gatekeeper.value}
              </span>
            </div>
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/90 mb-2 break-words whitespace-pre-wrap">
              {delulu.content || delulu.contentHash}
            </p>
            <div className="flex items-center gap-4 text-xs text-white/60">
              <span>
                {isEndingSoon() ? (
                  <span className="text-delulu-yellow font-medium">
                    Ends in {formatTimeRemaining(delulu.stakingDeadline)}
                  </span>
                ) : (
                  <span>
                    {delulu.isResolved
                      ? "Resolved"
                      : delulu.isCancelled
                      ? "Cancelled"
                      : "Active"}
                  </span>
                )}
              </span>
              <span>
                {delulu.totalStake > 0
                  ? delulu.totalStake < 0.01
                    ? delulu.totalStake.toFixed(4)
                    : delulu.totalStake.toFixed(2)
                  : "0.00"}{" "}
                cUSD
              </span>
            </div>
          </div>
          {isCreator && (
            <DeluluMenu
              delulu={delulu}
              onCancel={onCancel}
              onResolve={() => setResolveSheetOpen(true)}
            />
          )}
        </div>
      </div>

      <ComingSoonSheet
        open={resolveSheetOpen}
        onOpenChange={setResolveSheetOpen}
      />
    </>
  );
}
