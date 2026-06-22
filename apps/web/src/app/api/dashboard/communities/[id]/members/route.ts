import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole, canAccessCommunity, toStaffSession } from "@/lib/dashboard/authorize";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { buildSparklineSeries, sparklineStartDate, todayUtcDateString } from "@/lib/community/claim-sparkline";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const communityId = params.id;
  const staff = toStaffSession(session);
  if (!isPlatformAdminRole(session.staffRole) && !canAccessCommunity(staff, communityId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { searchParams } = request.nextUrl;
  const filter = searchParams.get("filter") ?? "all";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  let memberQuery = admin
    .from("community_members")
    .select("id, wallet_address, joined_at, joined_via, gd_first_claimed_at, gd_claim_count", {
      count: "exact",
    })
    .eq("community_id", communityId)
    .eq("status", "active")
    .order("joined_at", { ascending: false });

  if (filter === "claimed") {
    memberQuery = memberQuery.not("gd_first_claimed_at", "is", null);
  } else if (filter === "unclaimed") {
    memberQuery = memberQuery.is("gd_first_claimed_at", null);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  memberQuery = memberQuery.range(from, to);

  const { data: members, error, count } = await memberQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const wallets = (members ?? []).map((m) => m.wallet_address.toLowerCase());
  const startDate = sparklineStartDate(30);
  const today = todayUtcDateString();

  const [{ data: allMembers }, { data: dailyRows }, { data: profiles }] = await Promise.all([
    admin
      .from("community_members")
      .select("gd_first_claimed_at")
      .eq("community_id", communityId)
      .eq("status", "active"),
    admin
      .from("community_member_daily_claims")
      .select("wallet_address, claim_date, claim_count")
      .eq("community_id", communityId)
      .gte("claim_date", startDate),
    wallets.length
      ? admin.from("profiles").select("address, username").in("address", wallets)
      : Promise.resolve({ data: [] as { address: string; username: string | null }[] }),
  ]);

  const usernameMap = new Map(
    (profiles ?? []).map((p) => [p.address.toLowerCase(), p.username]),
  );

  const communityDailyAgg = new Map<string, number>();
  for (const row of dailyRows ?? []) {
    communityDailyAgg.set(
      row.claim_date,
      (communityDailyAgg.get(row.claim_date) ?? 0) + (row.claim_count ?? 0),
    );
  }
  const claimsToday = communityDailyAgg.get(today) ?? 0;

  const communitySparkline = buildSparklineSeries(
    [...communityDailyAgg.entries()].map(([claim_date, claim_count]) => ({
      claim_date,
      claim_count,
    })),
  );

  const dailyByWallet = new Map<string, Map<string, number>>();
  for (const row of dailyRows ?? []) {
    const w = row.wallet_address.toLowerCase();
    const walletMap = dailyByWallet.get(w) ?? new Map<string, number>();
    walletMap.set(row.claim_date, (walletMap.get(row.claim_date) ?? 0) + (row.claim_count ?? 0));
    dailyByWallet.set(w, walletMap);
  }

  const total = allMembers?.length ?? 0;
  const claimed = (allMembers ?? []).filter((m) => m.gd_first_claimed_at).length;
  const unclaimed = total - claimed;

  const memberRows = (members ?? []).map((m) => {
    const wallet = m.wallet_address.toLowerCase();
    return {
      id: m.id,
      wallet_address: m.wallet_address,
      username: usernameMap.get(wallet) ?? null,
      joined_at: m.joined_at,
      joined_via: m.joined_via,
      gd_claim_count: m.gd_claim_count ?? 0,
      gd_first_claimed_at: m.gd_first_claimed_at,
      claimSparkline: buildSparklineSeries(
        [...(dailyByWallet.get(wallet)?.entries() ?? [])].map(([claim_date, claim_count]) => ({
          claim_date,
          claim_count,
        })),
      ),
    };
  });

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return NextResponse.json({
    stats: { total, claimed, unclaimed, claimsToday },
    communitySparkline,
    members: memberRows,
    page,
    totalPages,
    totalCount: count ?? 0,
  });
}
