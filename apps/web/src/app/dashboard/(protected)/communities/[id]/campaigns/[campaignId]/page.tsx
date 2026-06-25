import { notFound, redirect } from "next/navigation";
import { readAdminSession } from "@/lib/admin-session";
import {
  canAccessCommunity,
  isPlatformAdminRole,
  toStaffSession,
} from "@/lib/dashboard/authorize";
import { CampaignDetailClient } from "./campaign-detail-client";

export const dynamic = "force-dynamic";

export default async function DashboardCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string; campaignId: string }>;
}) {
  const { id, campaignId } = await params;
  const session = await readAdminSession();
  if (!session) redirect("/signin");

  if (!isPlatformAdminRole(session.staffRole) && !canAccessCommunity(toStaffSession(session), id)) {
    notFound();
  }

  return (
    <CampaignDetailClient
      communityId={id}
      campaignId={campaignId}
    />
  );
}
