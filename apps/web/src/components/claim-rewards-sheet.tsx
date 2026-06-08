"use client";

// G$ daily-claim removed on the MiniPay build.
export function ClaimRewardsSheet({
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  onOpenChange(false);
  return null;
}
