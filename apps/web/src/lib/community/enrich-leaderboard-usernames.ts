import type { getSupabaseAdmin } from "@/lib/push/supabase";

export type LeaderboardRowWithWallet = {
  wallet_address: string;
  username?: string | null;
  pfp_url?: string | null;
};

export async function enrichLeaderboardWithUsernames<
  T extends LeaderboardRowWithWallet,
>(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  rows: T[],
): Promise<Array<T & { username: string | null; pfp_url: string | null }>> {
  if (rows.length === 0) return [];

  const wallets = [...new Set(rows.map((r) => r.wallet_address.toLowerCase()))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("address, username, pfp_url")
    .in("address", wallets);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.address.toLowerCase(), p]),
  );

  return rows.map((row) => ({
    ...row,
    username:
      row.username ??
      profileMap.get(row.wallet_address.toLowerCase())?.username ??
      null,
    pfp_url:
      row.pfp_url ??
      profileMap.get(row.wallet_address.toLowerCase())?.pfp_url ??
      null,
  }));
}

export function formatLeaderboardDisplayName(options: {
  username?: string | null;
  walletAddress: string;
  isMe?: boolean;
  formatAddress: (address: string) => string;
}): string {
  if (options.isMe) return "You";
  if (options.username) return `@${options.username}`;
  return options.formatAddress(options.walletAddress);
}
