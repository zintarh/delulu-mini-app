import { Suspense } from "react";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { CommunitiesPageClient, type CommunityRow } from "./communities-page-client";

export const dynamic = "force-dynamic";

async function getCommunities(isPlatformAdmin: boolean, communityIds: string[]) {
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  let query = admin
    .from("communities")
    .select("id, name, slug, description, member_invite_code, status, created_at")
    .order("created_at", { ascending: false });

  if (!isPlatformAdmin) {
    if (communityIds.length === 0) return [];
    query = query.in("id", communityIds);
  }

  const { data } = await query;
  const rows = data ?? [];

  const ids = rows.map((c: { id: string }) => c.id);
  const { data: memberRows } = ids.length
    ? await admin
        .from("community_members")
        .select("community_id, gd_first_claimed_at")
        .in("community_id", ids)
        .eq("status", "active")
    : { data: [] };

  const statsMap: Record<string, { total: number; claimed: number; unclaimed: number }> = {};
  for (const row of memberRows ?? []) {
    const entry = statsMap[row.community_id] ?? { total: 0, claimed: 0, unclaimed: 0 };
    entry.total += 1;
    if (row.gd_first_claimed_at) entry.claimed += 1;
    else entry.unclaimed += 1;
    statsMap[row.community_id] = entry;
  }

  return rows.map((c: { id: string; [key: string]: unknown }) => {
    const stats = statsMap[c.id] ?? { total: 0, claimed: 0, unclaimed: 0 };
    return {
      ...c,
      member_count: stats.total,
      claimed_count: stats.claimed,
      unclaimed_count: stats.unclaimed,
    };
  }) as CommunityRow[];
}

export default async function AdminCommunitiesPage() {
  const session = await readAdminSession();
  if (!session) return null;

  const isPlatformAdmin = isPlatformAdminRole(session.staffRole);
  const communities = await getCommunities(isPlatformAdmin, session.communityIds);

  return (
    <Suspense>
      <CommunitiesPageClient communities={communities} isPlatformAdmin={isPlatformAdmin} />
    </Suspense>
  );
}
