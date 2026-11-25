/** Welcome gift settings, safe for server and client (lib/onboarding/gift.ts is server-only). */
export const ONBOARDING_GIFT_GDOLLARS = 500;
/**
 * Off from 25 Nov 2026: new players start with their own free daily claim
 * (~120 G$) on a 100 G$ First Week instead of a gift from us. Gifts already
 * deposited stay claimable. Flip back on to resume new grants.
 */
export const ONBOARDING_GIFT_ENABLED = false;
