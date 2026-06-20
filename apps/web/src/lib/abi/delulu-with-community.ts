import { DELULU_ABI } from "@/lib/abi";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";

/** Full Delulu ABI including community campaign functions (post-upgrade). */
export const DELULU_ABI_WITH_COMMUNITY = [
  ...DELULU_ABI,
  ...COMMUNITY_CAMPAIGN_ABI,
] as const;
