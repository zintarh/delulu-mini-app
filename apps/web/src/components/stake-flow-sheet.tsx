"use client";

import type { FormattedDelulu } from "@/lib/types";
import { useUserPosition } from "@/hooks/use-user-position";
import { StakingSheet } from "@/components/staking-sheet";
import { StakePositionSheet } from "@/components/stake-position-sheet";

interface StakeFlowSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delulu: FormattedDelulu | null;
}

/**
 * Entry point for staking UI:
 * - If user has not staked: show full staking interface (StakingSheet).
 * - If user has already staked: show position-only sheet (StakePositionSheet).
 */
export function StakeFlowSheet({
  open,
  onOpenChange,
  delulu,
}: StakeFlowSheetProps) {
  // Call hook unconditionally (before any early returns)
  const deluluIdForPosition = delulu ? Number(delulu.onChainId) : null;
  const {
    hasStaked,
    isBeliever,
  } = useUserPosition(deluluIdForPosition);

  if (!delulu) return null;

  if (hasStaked) {
    return (
      <StakePositionSheet
        open={open}
        onOpenChange={onOpenChange}
        isBeliever={isBeliever}
      />
    );
  }

  return (
    <StakingSheet
      open={open}
      onOpenChange={onOpenChange}
      delulu={delulu}
    />
  );
}

