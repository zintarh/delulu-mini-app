"use client";

import { Loader2 } from "lucide-react";
import {
  DashboardModal,
  DashboardPrimaryButton,
  useDashboardToast,
} from "@/components/dashboard/dashboard-ui";
import { useDeleteCommunity } from "@/hooks/dashboard/use-dashboard-communities";

export function DeleteCommunityModal({
  open,
  onOpenChange,
  communityId,
  name,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string | null;
  name: string;
  onDeleted?: () => void;
}) {
  const { show } = useDashboardToast();
  const deleteCommunity = useDeleteCommunity();

  const handleDelete = async () => {
    if (!communityId) return;
    try {
      await deleteCommunity.mutateAsync(communityId);
      show("Community deleted");
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      show(err instanceof Error ? err.message : "Failed to delete community");
    }
  };

  return (
    <DashboardModal
      open={open}
      onOpenChange={(next) => {
        if (!deleteCommunity.isPending) onOpenChange(next);
      }}
      title="Delete community?"
      description={
        name
          ? `"${name}" and all of its campaigns, members and invites will be permanently removed. This cannot be undone.`
          : "This community and all of its campaigns, members and invites will be permanently removed. This cannot be undone."
      }
    >
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={deleteCommunity.isPending}
          onClick={() => onOpenChange(false)}
          className="rounded-xl border border-[#e8e8e3] px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[#f9f8f4] disabled:opacity-60"
        >
          Cancel
        </button>
        <DashboardPrimaryButton
          type="button"
          disabled={deleteCommunity.isPending || !communityId}
          onClick={() => void handleDelete()}
          className="bg-red-600 hover:bg-red-700"
        >
          {deleteCommunity.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Deleting…
            </>
          ) : (
            "Delete community"
          )}
        </DashboardPrimaryButton>
      </div>
    </DashboardModal>
  );
}
