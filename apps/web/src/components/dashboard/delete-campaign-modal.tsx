"use client";

import { Loader2 } from "lucide-react";
import {
  DashboardModal,
  DashboardPrimaryButton,
  useDashboardToast,
} from "@/components/dashboard/dashboard-ui";
import { useDeleteCampaign } from "@/hooks/dashboard/use-dashboard-campaigns";

export function DeleteCampaignModal({
  open,
  onOpenChange,
  campaignId,
  title,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string | null;
  title: string;
  onDeleted?: () => void;
}) {
  const { show } = useDashboardToast();
  const deleteCampaign = useDeleteCampaign();

  const handleDelete = async () => {
    if (!campaignId) return;
    try {
      await deleteCampaign.mutateAsync(campaignId);
      show("Campaign deleted");
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      show(err instanceof Error ? err.message : "Failed to delete campaign");
    }
  };

  return (
    <DashboardModal
      open={open}
      onOpenChange={(next) => {
        if (!deleteCampaign.isPending) onOpenChange(next);
      }}
      title="Delete campaign?"
      description={
        title
          ? `"${title}" will be permanently removed. This cannot be undone.`
          : "This campaign will be permanently removed. This cannot be undone."
      }
    >
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={deleteCampaign.isPending}
          onClick={() => onOpenChange(false)}
          className="rounded-xl border border-[#e8e8e3] px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[#f9f8f4] disabled:opacity-60"
        >
          Cancel
        </button>
        <DashboardPrimaryButton
          type="button"
          disabled={deleteCampaign.isPending || !campaignId}
          onClick={() => void handleDelete()}
          className="bg-red-600 hover:bg-red-700"
        >
          {deleteCampaign.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Deleting…
            </>
          ) : (
            "Delete campaign"
          )}
        </DashboardPrimaryButton>
      </div>
    </DashboardModal>
  );
}
