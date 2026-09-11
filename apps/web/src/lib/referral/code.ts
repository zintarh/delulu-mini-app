import { randomBytes } from "crypto";
import type { getSupabaseAdmin } from "@/lib/push/supabase";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

// Avoid ambiguous characters (0/O, 1/I) so codes are easy to read/type off a screen.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(len = 8): string {
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * Returns the profile's referral_code, generating and persisting one if
 * missing. Retries on a unique-index collision (profiles_referral_code_unique_idx).
 */
export async function ensureReferralCode(
  admin: SupabaseAdmin,
  address: string,
): Promise<string | null> {
  const normalized = address.toLowerCase();

  const { data: existing } = await admin
    .from("profiles")
    .select("referral_code")
    .eq("address", normalized)
    .maybeSingle();
  if (existing?.referral_code) return existing.referral_code as string;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateReferralCode();
    const { data, error } = await admin
      .from("profiles")
      .update({ referral_code: candidate })
      .eq("address", normalized)
      .is("referral_code", null) // don't clobber a concurrently-set code
      .select("referral_code")
      .maybeSingle();

    if (!error && data?.referral_code) return data.referral_code as string;
    if (error && !/duplicate|unique/i.test(error.message)) throw error;
    // duplicate -> loop and try a new candidate
  }

  return null;
}
