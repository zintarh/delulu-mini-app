import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { fetchForfeitStakedLeaderboardFromGraph } from "@/lib/community/campaign-subgraph";
import { enrichLeaderboardWithUsernames } from "@/lib/community/enrich-leaderboard-usernames";
import { isLeaderboardBlacklisted } from "@/lib/constant";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

function formatAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

/** "Charity" and "Delulu" both settle on-chain to CommunityPool (destinationType 3) —
 *  is_charity_intent (set off-chain at creation) is the only place they split. */
function destinationLabel(kind: "self" | "charity" | "friend" | "delulu", isCharityIntent: boolean): string {
  if (kind === "delulu" && isCharityIntent) return "Charity";
  switch (kind) {
    case "self":
      return "Self return";
    case "charity":
      return "Charity";
    case "friend":
      return "Friend";
    default:
      return "Delulu";
  }
}

export async function GET(request: NextRequest) {
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") ?? "0") || 0);
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase() || null;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const rows = await fetchForfeitStakedLeaderboardFromGraph();

  const filtered = rows.filter((row) => !isLeaderboardBlacklisted(row.wallet_address));

  const communityPoolIds = [
    ...new Set(filtered.filter((r) => r.destination_kind === "delulu").map((r) => r.commitment_id)),
  ];
  const { data: intents } =
    communityPoolIds.length > 0
      ? await admin
          .from("forfeit_commitments")
          .select("on_chain_commitment_id, is_charity_intent")
          .in("on_chain_commitment_id", communityPoolIds)
      : { data: [] as Array<{ on_chain_commitment_id: number; is_charity_intent: boolean | null }> };
  const charityIntentById = new Map(
    (intents ?? []).map((r) => [r.on_chain_commitment_id, Boolean(r.is_charity_intent)]),
  );

  const friendAddresses = [
    ...new Set(
      filtered
        .filter((r) => r.destination_kind === "friend" && r.destination_addr)
        .map((r) => r.destination_addr!.toLowerCase()),
    ),
  ];
  const { data: friendProfiles } =
    friendAddresses.length > 0
      ? await admin.from("profiles").select("address, username").in("address", friendAddresses)
      : { data: [] as Array<{ address: string; username: string | null }> };
  const friendUsernameByAddr = new Map(
    (friendProfiles ?? []).map((p) => [p.address.toLowerCase(), p.username]),
  );

  const combined = filtered
    .map((row) => ({
      ...row,
      destination_label: destinationLabel(
        row.destination_kind,
        charityIntentById.get(row.commitment_id) ?? false,
      ),
      destination_name:
        row.destination_kind === "friend" && row.destination_addr
          ? (() => {
              const username = friendUsernameByAddr.get(row.destination_addr!.toLowerCase());
              return username ? `@${username}` : formatAddr(row.destination_addr!);
            })()
          : null,
    }))
    .sort((a, b) => {
      const amountDiff = b.staked_amount - a.staked_amount;
      if (amountDiff !== 0) return amountDiff;
      // Same stake → whoever committed first ranks higher.
      return a.created_at - b.created_at;
    });

  const enriched = await enrichLeaderboardWithUsernames(admin, combined);

  const totalCount = enriched.length;
  const from = page * PAGE_SIZE;
  const pageRows = enriched.slice(from, from + PAGE_SIZE).map((row, idx) => ({
    rank: from + idx + 1,
    commitment_id: row.commitment_id,
    wallet_address: row.wallet_address,
    username: row.username,
    staked_amount: row.staked_amount,
    status: row.status,
    destination_kind: row.destination_kind,
    destination_label: row.destination_label,
    destination_name: row.destination_name,
    duration_seconds: row.duration_seconds,
  }));

  let myEntry: (typeof pageRows)[number] | null = null;
  if (address) {
    const idx = enriched.findIndex((row) => row.wallet_address.toLowerCase() === address);
    if (idx !== -1) {
      const row = enriched[idx];
      myEntry = {
        rank: idx + 1,
        commitment_id: row.commitment_id,
        wallet_address: row.wallet_address,
        username: row.username,
        staked_amount: row.staked_amount,
        status: row.status,
        destination_kind: row.destination_kind,
        destination_label: row.destination_label,
        destination_name: row.destination_name,
        duration_seconds: row.duration_seconds,
      };
    }
  }

  return NextResponse.json({
    leaderboard: pageRows,
    hasMore: from + PAGE_SIZE < totalCount,
    totalCount,
    myEntry,
  });
}
