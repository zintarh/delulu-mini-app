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
  const { data: counts } = ids.length
    ? await admin.from("community_members").select("community_id").in("community_id", ids).eq("status", "active")
    : { data: [] };

  const countMap: Record<string, number> = {};
  for (const row of counts ?? []) {
    countMap[row.community_id] = (countMap[row.community_id] ?? 0) + 1;
  }

  return rows.map((c: { id: string; [key: string]: unknown }) => ({
    ...c,
    member_count: countMap[c.id] ?? 0,
  })) as CommunityRow[];
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
