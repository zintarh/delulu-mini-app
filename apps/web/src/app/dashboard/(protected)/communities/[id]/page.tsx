import { notFound } from "next/navigation";
import { readAdminSession } from "@/lib/admin-session";
import {
  canAccessCommunity,
  isPlatformAdminRole,
  toStaffSession,
} from "@/lib/dashboard/authorize";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { CommunityDetailClient } from "./community-detail-client";

export const dynamic = "force-dynamic";

async function getCommunity(id: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("communities")
    .select("id, name, slug, description, member_invite_code, status, created_at")
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function getMemberStats(communityId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return { memberCount: 0, claimedCount: 0, unclaimedCount: 0 };

  const { data: rows } = await admin
    .from("community_members")
    .select("gd_first_claimed_at")
    .eq("community_id", communityId)
    .eq("status", "active");

  const total = rows?.length ?? 0;
  const claimed = (rows ?? []).filter((r) => r.gd_first_claimed_at).length;
  return {
    memberCount: total,
    claimedCount: claimed,
    unclaimedCount: total - claimed,
  };
}

export default async function AdminCommunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await readAdminSession();
  if (!session) return null;

  const isPlatformAdmin = isPlatformAdminRole(session.staffRole);

  if (!isPlatformAdmin && !canAccessCommunity(toStaffSession(session), id)) {
    notFound();
  }

  const [community, memberStats] = await Promise.all([getCommunity(id), getMemberStats(id)]);
  if (!community) notFound();

  return (
    <CommunityDetailClient
      community={community}
      memberStats={memberStats}
      isPlatformAdmin={isPlatformAdmin}
      communityId={id}
    />
  );
}
