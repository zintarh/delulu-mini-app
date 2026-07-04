"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Copy,
  UserPlus,
  Users,
  ChevronLeft,
  Plus,
  Target,
  LogIn,
  Check,
  X,
  Wallet,
  ExternalLink,
  Pencil,
  Trash2,
} from "lucide-react";
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
  DashboardTableCard,
  DashboardTableLoading,
  DashboardTableEmptyState,
  DashboardTableScroll,
  DashboardTableHead,
  DashboardTableHeadRow,
  DashboardTableHeadCell,
  DashboardTableBody,
  DashboardTableRow,
  DashboardTableCell,
  StatusChip,
  useDashboardToast,
} from "@/components/dashboard/dashboard-ui";
import { InviteSubAdminModal } from "@/components/dashboard/invite-subadmin-modal";
import { CreateCampaignModal } from "@/components/dashboard/create-campaign-modal";
import { DeleteCampaignModal } from "@/components/dashboard/delete-campaign-modal";
import { ApproveCampaignModal } from "@/components/dashboard/approve-campaign-modal";
import { RejectCampaignModal } from "@/components/dashboard/reject-campaign-modal";
import { FundCampaignModal } from "@/components/dashboard/fund-campaign-modal";
import { EditCommunityModal } from "@/components/dashboard/edit-community-modal";
import { DeleteCommunityModal } from "@/components/dashboard/delete-community-modal";
import { useDashboardCampaigns, type DashboardCampaign } from "@/hooks/dashboard/use-dashboard-campaigns";
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

function ActionButtons({
  campaign,
  communityId,
  onApprove,
  onReject,
  onFund,
  onDelete,
}: {
  campaign: DashboardCampaign;
  communityId: string;
  onApprove: (c: DashboardCampaign) => void;
  onReject: (c: { id: string; title: string }) => void;
  onFund: (c: DashboardCampaign) => void;
  onDelete: (c: { id: string; title: string }) => void;
}) {
  const s = campaign.status;
  return (
    <div className="flex items-center gap-1.5">
      {s === "pending_approval" ? (
        <>
          <button
            type="button"
            onClick={() => onApprove(campaign)}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <Check className="h-3 w-3" />
            Approve
          </button>
          <button
            type="button"
            onClick={() => onReject({ id: campaign.id, title: campaign.title })}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            <X className="h-3 w-3" />
            Reject
          </button>
        </>
      ) : s === "approved" ? (
        <button
          type="button"
          onClick={() => onFund(campaign)}
          className="inline-flex items-center gap-1 rounded-lg bg-delulu-blue px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-delulu-blue/90"
        >
          <Wallet className="h-3 w-3" />
          Fund
        </button>
      ) : null}

      <Link
        href={`/dashboard/communities/${communityId}/campaigns/${campaign.id}`}
        className="inline-flex items-center gap-1 rounded-lg border border-[#e8e8e3] px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="h-3 w-3" />
        Details
      </Link>

      {(s === "draft" || s === "rejected") ? (
        <button
          type="button"
          onClick={() => onDelete({ id: campaign.id, title: campaign.title })}
          className="inline-flex items-center gap-1 rounded-lg border border-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50"
        >
          <X className="h-3 w-3" />
          Delete
        </button>
      ) : null}
    </div>
  );
}

export function CommunityDetailClient({
  community: initialCommunity,
  memberStats,
  isPlatformAdmin,
  communityId,
}: {
  community: Community;
  memberStats: MemberStats;
  isPlatformAdmin: boolean;
  communityId: string;
}) {
  const router = useRouter();
  const [community, setCommunity] = useState<Community>(initialCommunity);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<HubTab>("campaigns");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [approveTarget, setApproveTarget] = useState<DashboardCampaign | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; title: string } | null>(null);
  const [fundTarget, setFundTarget] = useState<DashboardCampaign | null>(null);
  const [editCommunityOpen, setEditCommunityOpen] = useState(false);
  const [deleteCommunityOpen, setDeleteCommunityOpen] = useState(false);

  const { show } = useDashboardToast();
  const { data: campaigns = [], isLoading, refetch } = useDashboardCampaigns({ communityId });

  const openCampaigns = campaigns.filter((c) => isCampaignParticipatable(c.status)).length;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const pendingCount = campaigns.filter((c) => c.status === "pending_approval").length;
  const approvedCount = campaigns.filter((c) => c.status === "approved").length;

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
            <>
              <DashboardPrimaryButton onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Invite
              </DashboardPrimaryButton>
              <DashboardIconButton title="Edit community" onClick={() => setEditCommunityOpen(true)}>
                <Pencil className="h-4 w-4" />
              </DashboardIconButton>
              <DashboardIconButton
                title="Delete community"
                onClick={() => setDeleteCommunityOpen(true)}
                className="text-red-500 hover:border-red-200 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </DashboardIconButton>
            </>
          ) : null}
        </div>
      </div>

      <DashboardStatGrid>
        <DashboardStat label="Members" value={memberStats.memberCount} />
        <DashboardStat label="Claimed G$" value={memberStats.claimedCount} />
        <DashboardStat label="Unclaimed" value={memberStats.unclaimedCount} />
        <DashboardStat label="Open campaigns" value={openCampaigns} />
        <DashboardStat label="Active" value={activeCampaigns} />
        {pendingCount > 0 ? <DashboardStat label="Pending approval" value={pendingCount} /> : null}
        {approvedCount > 0 ? <DashboardStat label="Needs funding" value={approvedCount} /> : null}
      </DashboardStatGrid>

      <HubTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        campaignCount={campaigns.length}
        memberCount={memberStats.memberCount}
      />

      {activeTab === "campaigns" ? (
        isLoading ? (
          <DashboardTableLoading />
        ) : campaigns.length === 0 ? (
          <DashboardPanel>
            <p className="py-10 text-center text-sm text-muted-foreground">No campaigns yet</p>
          </DashboardPanel>
        ) : (
          <DashboardTableCard>
            <DashboardTableScroll>
              <DashboardTableHead>
                <DashboardTableHeadRow>
                  <DashboardTableHeadCell>Campaign</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Status</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Pool</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Cadence</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Actions</DashboardTableHeadCell>
                </DashboardTableHeadRow>
              </DashboardTableHead>
              <DashboardTableBody>
                {campaigns.map((c) => (
                  <DashboardTableRow key={c.id}>
                    {/* Title + thumbnail */}
                    <DashboardTableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        {c.cover_image_url ? (
                          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                            <Image
                              src={c.cover_image_url}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-delulu-blue-light text-delulu-blue">
                            <Target className="h-4 w-4" />
                          </span>
                        )}
                        <span className="min-w-0 max-w-[220px] truncate font-semibold text-foreground text-sm">
                          {c.title}
                        </span>
                      </div>
                    </DashboardTableCell>

                    {/* Status */}
                    <DashboardTableCell>
                      <StatusChip status={c.status} />
                    </DashboardTableCell>

                    {/* Pool */}
                    <DashboardTableCell>
                      <span className="text-sm text-foreground">
                        {c.proposed_pool_amount > 0 ? `${c.proposed_pool_amount} G$` : "—"}
                      </span>
                    </DashboardTableCell>

                    {/* Cadence */}
                    <DashboardTableCell>
                      <span className="capitalize text-sm text-muted-foreground">
                        {c.proof_cadence}
                      </span>
                    </DashboardTableCell>

                    {/* Actions */}
                    <DashboardTableCell>
                      <ActionButtons
                        campaign={c}
                        communityId={communityId}
                        onApprove={setApproveTarget}
                        onReject={setRejectTarget}
                        onFund={setFundTarget}
                        onDelete={setDeleteTarget}
                      />
                    </DashboardTableCell>
                  </DashboardTableRow>
                ))}
              </DashboardTableBody>
            </DashboardTableScroll>
          </DashboardTableCard>
        )
      ) : (
        <CommunityMembersPanel communityId={communityId} />
      )}

      {/* ── Modals ── */}
      <CreateCampaignModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        communityId={communityId}
        onSuccess={({ submitted }) => {
          show(submitted ? "Campaign submitted for approval" : "Campaign saved as draft");
          void refetch();
        }}
      />

      <DeleteCampaignModal
        open={deleteTarget != null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        campaignId={deleteTarget?.id ?? null}
        title={deleteTarget?.title ?? ""}
      />

      {approveTarget ? (
        <ApproveCampaignModal
          open
          onOpenChange={(open) => { if (!open) setApproveTarget(null); }}
          campaign={approveTarget}
          onSuccess={() => { show("Campaign approved"); void refetch(); setApproveTarget(null); }}
        />
      ) : null}

      {rejectTarget ? (
        <RejectCampaignModal
          open
          onOpenChange={(open) => { if (!open) setRejectTarget(null); }}
          campaignId={rejectTarget.id}
          campaignTitle={rejectTarget.title}
          onSuccess={() => { show("Campaign rejected"); void refetch(); setRejectTarget(null); }}
        />
      ) : null}

      {fundTarget ? (
        <FundCampaignModal
          open
          onOpenChange={(open) => { if (!open) setFundTarget(null); }}
          campaign={fundTarget}
          onSuccess={() => { show("Campaign funded"); void refetch(); setFundTarget(null); }}
        />
      ) : null}

      {isPlatformAdmin ? (
        <InviteSubAdminModal
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          communityId={communityId}
          onSuccess={(email) => show(`Invite sent to ${email}`)}
        />
      ) : null}

      {isPlatformAdmin ? (
        <>
          <EditCommunityModal
            open={editCommunityOpen}
            onOpenChange={setEditCommunityOpen}
            community={community}
            onSuccess={(updated) => {
              setCommunity((current) => ({ ...current, name: updated.name, description: updated.description }));
              show("Community updated");
            }}
          />

          <DeleteCommunityModal
            open={deleteCommunityOpen}
            onOpenChange={setDeleteCommunityOpen}
            communityId={community.id}
            name={community.name}
            onDeleted={() => router.push("/dashboard/communities")}
          />
        </>
      ) : null}
    </DashboardPage>
  );
}
