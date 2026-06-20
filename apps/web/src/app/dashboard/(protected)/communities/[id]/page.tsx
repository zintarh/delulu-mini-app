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

async function getMembers(communityId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data } = await admin
    .from("community_members")
    .select("id, wallet_address, status, joined_at, joined_via")
    .eq("community_id", communityId)
    .order("joined_at", { ascending: false })
    .limit(50);
  return data ?? [];
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

  const [community, members] = await Promise.all([getCommunity(id), getMembers(id)]);
  if (!community) notFound();

  return (
    <CommunityDetailClient
      community={community}
      members={members}
      isPlatformAdmin={isPlatformAdmin}
      communityId={id}
    />
  );
}
