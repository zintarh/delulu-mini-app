import type { ReferralEligibilitySteps } from "@/lib/referral/eligibility";
import { ONBOARDING_GIFT_ENABLED } from "@/lib/onboarding/gift-config";

export const ONBOARDING_STEP_LABELS: { key: keyof ReferralEligibilitySteps; label: string }[] = [
  { key: "verified", label: "Do a face verification" },
  { key: "claimedUbi", label: "Claim your daily G$" },
  // The welcome gift is off for new players (25 Nov 2026): no step to show.
  ...(ONBOARDING_GIFT_ENABLED ? [{ key: "claimedGift" as const, label: "Claim your 500 G$ welcome gift" }] : []),
  { key: "completedCampaign", label: "Join a mission worth 1,000 G$" },
];
