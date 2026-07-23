import { normalizeEmail, isValidEmail } from "@/lib/email-validation";

export type ProfileAuthProvider = "privy" | "web3auth" | null;

export type EmailCheckResult = {
  taken: boolean;
  auth_provider: ProfileAuthProvider;
};

const CACHE = new Map<string, EmailCheckResult>();

export function pickAuthProvider(input: EmailCheckResult): "privy" | "web3auth" {
  if (input.taken && input.auth_provider === "privy") return "privy";
  if (input.taken && input.auth_provider === "web3auth") return "web3auth";
  return "web3auth";
}

export function peekCachedEmailCheck(email: string): EmailCheckResult | undefined {
  return CACHE.get(normalizeEmail(email));
}

export async function lookupEmailProvider(
  email: string,
  signal?: AbortSignal,
): Promise<EmailCheckResult> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    throw new Error("Invalid email");
  }

  const cached = CACHE.get(normalized);
  if (cached) return cached;

  const res = await fetch(
    `/api/profile/check-email?email=${encodeURIComponent(normalized)}`,
    { signal },
  );
  if (!res.ok) throw new Error("Could not check email");

  const result = (await res.json()) as EmailCheckResult;
  CACHE.set(normalized, result);
  return result;
}
