"use client";

import type { FormattedDelulu } from "@/lib/types";
import { StakingSheet } from "@/components/staking-sheet";

interface StakeFlowSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delulu: FormattedDelulu | null;
}

export function StakeFlowSheet({
  open,
  onOpenChange,
  delulu,
}: StakeFlowSheetProps) {
  if (!delulu) return null;

  return (
    <StakingSheet
      open={open}
      onOpenChange={onOpenChange}
      delulu={delulu}
    />
  );
}

