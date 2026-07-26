import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DELULU_ABI } from "@/lib/abi";
import { DELULU_CHAIN_ID, getDeluluContractAddress } from "@/lib/constant";

const CELO_RPC =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  process.env.CELO_RPC_URL ??
  "https://forno.celo.org";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC),
});

function cleanUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Contract can return empty string for unset usernames.
  return trimmed;
}

/**
 * Resolve a display username for emails / notifications.
 * Prefer profiles (case-insensitive address), then on-chain getUsername.
 */
export async function resolveUsernameForAddress(
  admin: SupabaseClient,
  address: string,
): Promise<string | null> {
  const normalized = address.trim().toLowerCase();
  if (!normalized.startsWith("0x") || normalized.length !== 42) return null;

  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("username")
      .ilike("address", normalized)
      .maybeSingle();
    const fromProfile = cleanUsername(profile?.username);
    if (fromProfile) return fromProfile;
  } catch {
    // fall through to on-chain
  }

  try {
    const onChain = await publicClient.readContract({
      address: getDeluluContractAddress(DELULU_CHAIN_ID),
      abi: DELULU_ABI,
      functionName: "getUsername",
      args: [normalized as `0x${string}`],
    });
    return cleanUsername(onChain);
  } catch {
    return null;
  }
}
