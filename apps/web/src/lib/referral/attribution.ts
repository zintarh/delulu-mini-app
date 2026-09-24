import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { getReferrerStanding } from "@/lib/referral/standing";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export function normalizeReferralCode(code: string | null | undefined): string | null {
  const normalized = code?.trim().toUpperCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

/**
 * Sets profiles.referred_by once, immutably, for a brand-new user who signed
 * up through a referral link. Never throws into the caller — a bad/unknown
 * code or a self-referral attempt should never block profile creation.
 */
export async function attributeReferral(
  admin: SupabaseAdmin,
  newUserAddress: string,
  referredByCodeRaw?: string | null,
): Promise<void> {
  const code = normalizeReferralCode(referredByCodeRaw);
  if (!code) return; // no ?ref= — silent no-op, not an error

  const normalized = newUserAddress.toLowerCase();

  const { data: referrer } = await admin
    .from("profiles")
    .select("address")
    .eq("referral_code", code)
    .maybeSingle();
  if (!referrer) return; // invalid/unknown code — ignore, never block signup

  const referrerAddress = String(referrer.address).toLowerCase();
  if (referrerAddress === normalized) return; // self-referral guard

  // Backstop for the invite gate on /sign-in: a referrer who's behind on
  // their own campaign can't pick up new referrals until today's proof is in.
  if ((await getReferrerStanding(admin, referrerAddress)).locked) return;

  await admin
    .from("profiles")
    .update({ referred_by: referrerAddress })
    .eq("address", normalized)
    .is("referred_by", null); // immutability guard — never overwrite an existing attribution
}
