import { NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const isPlatformAdmin = isPlatformAdminRole(session.staffRole);
  const communityIds = session.communityIds;

  let communitiesQuery = admin.from("communities").select("id, status", { count: "exact", head: false });
  if (!isPlatformAdmin) {
    if (communityIds.length === 0) {
      return NextResponse.json({
        communities: { total: 0, active: 0 },
        campaigns: { total: 0, byStatus: {}, pendingApproval: 0, active: 0, funded: 0 },
        users: { total: 0, newThisWeek: 0 },
        members: { total: 0, claimed: 0 },
      });
    }
    communitiesQuery = communitiesQuery.in("id", communityIds);
  }

  // "New signups" resets on the most recent Wednesday (UTC midnight) rather
  // than a rolling 7-day window, per the team's weekly reporting cadence.
  const now = new Date();
  const daysSinceWednesday = (now.getUTCDay() - 3 + 7) % 7; // 0=Sun..3=Wed..6=Sat
  const sinceWednesday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceWednesday),
  );

  const [
    { data: communities, count: communityCount },
    campaignsResult,
    { count: userCount },
    { count: newUsersCount },
    membersResult,
  ] = await Promise.all([
    communitiesQuery,
    (async () => {
      let q = admin.from("community_campaigns").select("status");
      if (!isPlatformAdmin) q = q.in("community_id", communityIds);
      return q;
    })(),
    admin.from("profiles").select("address", { count: "exact", head: true }),
    admin.from("profiles").select("address", { count: "exact", head: true }).gte("created_at", sinceWednesday.toISOString()),
    (async () => {
      if (!isPlatformAdmin && communityIds.length === 0) {
        return { data: [] as { gd_first_claimed_at: string | null }[] };
      }
      let q = admin.from("community_members").select("gd_first_claimed_at").eq("status", "active");
      if (!isPlatformAdmin) q = q.in("community_id", communityIds);
      return q;
    })(),
  ]);

  const activeCommunities = (communities ?? []).filter((c) => c.status === "active").length;

  const byStatus: Record<string, number> = {};
  for (const row of campaignsResult.data ?? []) {
    const s = String(row.status);
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }
  const campaignTotal = campaignsResult.data?.length ?? 0;

  const memberRows = membersResult.data ?? [];
  const claimedMembers = memberRows.filter((m) => m.gd_first_claimed_at).length;

  return NextResponse.json(
    {
      communities: {
        total: communityCount ?? communities?.length ?? 0,
        active: activeCommunities,
      },
      campaigns: {
        total: campaignTotal,
        byStatus,
        pendingApproval: byStatus.pending_approval ?? 0,
        active: (byStatus.active ?? 0) + (byStatus.approved ?? 0),
        funded: (byStatus.active ?? 0) + (byStatus.funding ?? 0) + (byStatus.ended ?? 0),
      },
      users: {
        total: userCount ?? 0,
        newThisWeek: newUsersCount ?? 0,
      },
      members: {
        total: memberRows.length,
        claimed: claimedMembers,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
