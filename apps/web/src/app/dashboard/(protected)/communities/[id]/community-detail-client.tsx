"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Copy, UserPlus, Users, ChevronLeft, Plus, Target, LogIn } from "lucide-react";
import { CommunityMembersPanel } from "@/components/dashboard/community-members-panel";
import { buildSignInWithCommunityUrl } from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";
import {
  DashboardPage,
  DashboardStatGrid,
  DashboardStat,
  DashboardPanel,
  DashboardIconButton,
  DashboardPrimaryButton,
  DashboardCardGrid,
  DashboardCard,
  StatusChip,
  useDashboardToast,
} from "@/components/dashboard/dashboard-ui";
import { InviteSubAdminModal } from "@/components/dashboard/invite-subadmin-modal";
import { CreateCampaignModal } from "@/components/dashboard/create-campaign-modal";
import { CampaignCardMenu } from "@/components/dashboard/campaign-card-menu";
import {
  useDashboardCampaigns,
  useDeleteCampaign,
} from "@/hooks/dashboard/use-dashboard-campaigns";
import { isCampaignParticipatable } from "@/lib/community/campaign-types";

type Community = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  member_invite_code: string;
  status: string;
  created_at: string;
};

type MemberStats = {
  memberCount: number;
  claimedCount: number;
  unclaimedCount: number;
};

type HubTab = "campaigns" | "members";

function HubTabs({
  activeTab,
  onChange,
  campaignCount,
  memberCount,
}: {
  activeTab: HubTab;
  onChange: (tab: HubTab) => void;
  campaignCount: number;
  memberCount: number;
}) {
  const tabs: { id: HubTab; label: string }[] = [
    { id: "campaigns", label: `Campaigns (${campaignCount})` },
    { id: "members", label: `Members (${memberCount})` },
  ];

  return (
    <div className="mb-4 flex gap-2 border-b border-[#e8e8e3]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
            activeTab === tab.id
              ? "border-delulu-blue text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function CommunityDetailClient({
  community,
  memberStats,
  isPlatformAdmin,
  communityId,
}: {
  community: Community;
  memberStats: MemberStats;
  isPlatformAdmin: boolean;
  communityId: string;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<HubTab>("campaigns");
  const { show } = useDashboardToast();
  const deleteCampaign = useDeleteCampaign();
  const { data: campaigns = [], refetch } = useDashboardCampaigns({ communityId });

  const openCampaigns = campaigns.filter((c) => isCampaignParticipatable(c.status)).length;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

  const copyCode = async () => {
    await navigator.clipboard.writeText(community.member_invite_code);
    show("Invite code copied");
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/join/${community.member_invite_code}`;
    await navigator.clipboard.writeText(url);
    show("Join link copied");
  };

  const copyReferralSignIn = async () => {
    const url = `${window.location.origin}${buildSignInWithCommunityUrl(community.member_invite_code)}`;
    await navigator.clipboard.writeText(url);
    show("Referral sign-in link copied");
  };

  return (
    <DashboardPage>
      <Link
        href="/dashboard/communities"
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Communities
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">{community.name}</h1>
          <StatusChip status={community.status} />
        </div>
        <div className="flex items-center gap-2">
          <DashboardIconButton title="Copy code" onClick={copyCode}>
            <Copy className="h-4 w-4" />
          </DashboardIconButton>
          <DashboardIconButton title="Copy join link" onClick={copyLink}>
            <Users className="h-4 w-4" />
          </DashboardIconButton>
          <DashboardIconButton title="Copy referral sign-in link" onClick={copyReferralSignIn}>
            <LogIn className="h-4 w-4" />
          </DashboardIconButton>
          <DashboardPrimaryButton onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create campaign
          </DashboardPrimaryButton>
          {isPlatformAdmin ? (
            <DashboardPrimaryButton onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Invite
            </DashboardPrimaryButton>
          ) : null}
        </div>
      </div>

      <DashboardStatGrid>
        <DashboardStat label="Members" value={memberStats.memberCount} />
        <DashboardStat label="Claimed G$" value={memberStats.claimedCount} />
        <DashboardStat label="Unclaimed" value={memberStats.unclaimedCount} />
        <DashboardStat label="Open campaigns" value={openCampaigns} />
        <DashboardStat label="Funded campaigns" value={activeCampaigns} />
        <DashboardStat label="Code" value={community.member_invite_code} />
      </DashboardStatGrid>

      <HubTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        campaignCount={campaigns.length}
        memberCount={memberStats.memberCount}
      />

      {activeTab === "campaigns" ? (
        campaigns.length === 0 ? (
          <DashboardPanel>
            <p className="py-10 text-center text-sm text-muted-foreground">No campaigns yet</p>
          </DashboardPanel>
        ) : (
          <DashboardCardGrid>
            {campaigns.map((c) => (
              <DashboardCard key={c.id}>
                <div className="flex items-start gap-3">
                  <Link
                    href={`/dashboard/communities/${communityId}/campaigns/${c.id}`}
                    className="flex min-w-0 flex-1 items-start gap-3"
                  >
                    {c.cover_image_url ? (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={c.cover_image_url}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-delulu-blue-light text-delulu-blue">
                        <Target className="h-5 w-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground line-clamp-2">{c.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.proposed_pool_amount > 0
                          ? `${c.proposed_pool_amount} G$`
                          : "Pool at funding"}
                        {" · "}
                        {c.proof_cadence}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <CampaignCardMenu
                      campaignId={c.id}
                      communityId={communityId}
                      status={c.status}
                      title={c.title}
                      onDelete={() => {
                        void deleteCampaign
                          .mutateAsync(c.id)
                          .then(() => {
                            show("Campaign deleted");
                            void refetch();
                          })
                          .catch((err) => {
                            show(
                              err instanceof Error ? err.message : "Failed to delete campaign",
                            );
                          });
                      }}
                    />
                    <StatusChip status={c.status} />
                  </div>
                </div>
              </DashboardCard>
            ))}
          </DashboardCardGrid>
        )
      ) : (
        <CommunityMembersPanel communityId={communityId} />
      )}

      <CreateCampaignModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        communityId={communityId}
        onSuccess={({ submitted }) => {
          show(
            submitted ? "Campaign submitted for approval" : "Campaign saved as draft",
          );
          void refetch();
        }}
      />

      {isPlatformAdmin ? (
        <InviteSubAdminModal
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          communityId={communityId}
          onSuccess={(email) => show(`Invite sent to ${email}`)}
        />
      ) : null}
    </DashboardPage>
  );
}
