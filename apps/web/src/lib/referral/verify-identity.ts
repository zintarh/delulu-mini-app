import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { hasEverVerified, readIdentityStatus } from "@/lib/identity/status";

const CELO_RPC =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  process.env.CELO_RPC_URL ??
  "https://forno.celo.org";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC),
});

/**
 * Server-side, non-client-trusted GoodDollar face-verification check —
 * mirrors what apps/web/src/hooks/identityHook.ts does client-side. Reads
 * the actual re-verification ladder (see lib/identity/status.ts) rather
 * than just `getWhitelistedRoot() != 0`, which goes to zero the moment a
 * wallet's current window lapses and makes someone who verified last week
 * look identical to someone who never verified at all.
 *
 * Returns true for "verified" AND "lapsed" — every caller of this (referral
 * crediting, referral-link eligibility, the onboarding gift) cares whether
 * this wallet ever genuinely proved it's a real person, not whether it
 * happens to be inside its current rolling window right now. Only "none"
 * (never verified) and "blacklisted" return false. Fails closed: any RPC
 * error returns false, never credits anything on an uncertain check.
 */
export async function isGoodDollarVerified(address: string): Promise<boolean> {
  try {
    const status = await readIdentityStatus(publicClient, address);
    return hasEverVerified(status);
  } catch (err) {
    console.error("[referral] GoodDollar verification check failed", err);
    return false;
  }
}
