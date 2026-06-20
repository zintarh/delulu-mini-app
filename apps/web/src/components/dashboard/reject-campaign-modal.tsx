"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  DashboardModal,
  DashboardField,
  DashboardPrimaryButton,
  dashboardInputClass,
} from "@/components/dashboard/dashboard-ui";
import { useRejectCampaign } from "@/hooks/dashboard/use-dashboard-campaigns";

export function RejectCampaignModal({
  open,
  onOpenChange,
  campaignId,
  campaignTitle,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignTitle: string;
  onSuccess?: () => void;
}) {
  const reject = useRejectCampaign();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleReject = async () => {
    if (!reason.trim()) return;
    setError(null);
    try {
      await reject.mutateAsync({ id: campaignId, reason: reason.trim() });
      onOpenChange(false);
      setReason("");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    }
  };

  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title="Reject campaign"
      description={campaignTitle}
    >
      <div className="space-y-4 pt-2">
        <DashboardField label="Reason" required>
          <textarea
            rows={3}
            className={dashboardInputClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain what needs to change…"
          />
        </DashboardField>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <DashboardPrimaryButton
          className="w-full bg-red-600 hover:bg-red-600/90"
          disabled={reject.isPending || !reason.trim()}
          onClick={() => void handleReject()}
        >
          {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Reject
        </DashboardPrimaryButton>
      </div>
    </DashboardModal>
  );
}
