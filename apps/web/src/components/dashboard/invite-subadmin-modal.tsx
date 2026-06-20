"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  DashboardModal,
  DashboardField,
  DashboardPrimaryButton,
  dashboardInputClass,
} from "@/components/dashboard/dashboard-ui";
import { useInviteSubAdmin } from "@/hooks/dashboard/use-dashboard-communities";

export function InviteSubAdminModal({
  open,
  onOpenChange,
  communityId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  onSuccess?: (email: string) => void;
}) {
  const inviteSubAdmin = useInviteSubAdmin(communityId);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    try {
      const sentTo = await inviteSubAdmin.mutateAsync(email.trim());
      onSuccess?.(sentTo);
      onOpenChange(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const submitting = inviteSubAdmin.isPending;

  return (
    <DashboardModal
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="Invite sub-admin"
    >
      <form onSubmit={onSubmit} className="space-y-4 pt-2">
        <DashboardField label="Email" required>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            className={dashboardInputClass}
          />
        </DashboardField>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <DashboardPrimaryButton
          type="submit"
          disabled={submitting || !email.trim()}
          className="w-full"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Send invite
        </DashboardPrimaryButton>
      </form>
    </DashboardModal>
  );
}
