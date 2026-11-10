import type { ReferralEligibilitySteps } from "@/lib/referral/eligibility";

export const ONBOARDING_STEP_LABELS: { key: keyof ReferralEligibilitySteps; label: string }[] = [
  { key: "verified", label: "Do a face verification" },
  { key: "claimedUbi", label: "Claim your daily G$" },
  { key: "claimedGift", label: "Claim your 1,000 G$ welcome gift" },
  { key: "completedCampaign", label: "Join a campaign worth 1,000 G$" },
];
