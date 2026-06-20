"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, X } from "lucide-react";
import {
  DashboardPage,
  DashboardPageHeader,
  DashboardCard,
  DashboardCardGrid,
  DashboardEmpty,
  DashboardPrimaryButton,
  StatusChip,
  useDashboardToast,
} from "@/components/dashboard/dashboard-ui";
import {
  useDashboardCampaigns,
} from "@/hooks/dashboard/use-dashboard-campaigns";
import { ApproveCampaignModal } from "@/components/dashboard/approve-campaign-modal";
import { RejectCampaignModal } from "@/components/dashboard/reject-campaign-modal";

export function ApprovalsPageClient() {
  const { data: campaigns = [], isLoading, refetch } = useDashboardCampaigns({ status: "pending_approval" });
  const { show } = useDashboardToast();
  const [rejectTarget, setRejectTarget] = useState<{ id: string; title: string } | null>(null);
  const [approveTarget, setApproveTarget] = useState<(typeof campaigns)[number] | null>(null);

  return (
    <DashboardPage>
      <DashboardPageHeader title="Approvals" />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : campaigns.length === 0 ? (
        <DashboardEmpty icon={Check} title="Nothing to review" />
      ) : (
        <DashboardCardGrid>
          {campaigns.map((c) => (
            <DashboardCard key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{c.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.community?.name ?? "Community"} · {c.proposed_pool_amount} G$
                  </p>
                </div>
                <StatusChip status={c.status} />
              </div>
              <div className="mt-4 flex gap-2">
                <DashboardPrimaryButton
                  className="flex-1"
                  onClick={() => setApproveTarget(c)}
                >
                  <Check className="h-4 w-4" />
                  Approve
                </DashboardPrimaryButton>
                <button
                  type="button"
                  onClick={() => setRejectTarget({ id: c.id, title: c.title })}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#e8e8e3] px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                  Reject
                </button>
              </div>
              <Link
                href={`/dashboard/communities/${c.community_id}/campaigns/${c.id}`}
                className="mt-3 block text-xs font-semibold text-delulu-blue hover:underline"
              >
                View details
              </Link>
            </DashboardCard>
          ))}
        </DashboardCardGrid>
      )}

      {rejectTarget ? (
        <RejectCampaignModal
          open
          onOpenChange={(open) => !open && setRejectTarget(null)}
          campaignId={rejectTarget.id}
          campaignTitle={rejectTarget.title}
          onSuccess={() => show("Campaign rejected")}
        />
      ) : null}

      {approveTarget ? (
        <ApproveCampaignModal
          open
          onOpenChange={(open) => !open && setApproveTarget(null)}
          campaign={approveTarget}
          onSuccess={() => void refetch()}
        />
      ) : null}
    </DashboardPage>
  );
}
