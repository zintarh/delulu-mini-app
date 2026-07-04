"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DashboardModal,
  DashboardField,
  DashboardPrimaryButton,
  dashboardInputClass,
} from "@/components/dashboard/dashboard-ui";
import {
  useUpdateCommunity,
  type DashboardCommunity,
} from "@/hooks/dashboard/use-dashboard-communities";

export function EditCommunityModal({
  open,
  onOpenChange,
  community,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  community: Pick<DashboardCommunity, "id" | "name" | "description">;
  onSuccess?: (community: DashboardCommunity) => void;
}) {
  const updateCommunity = useUpdateCommunity(community.id);
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(community.name);
      setDescription(community.description ?? "");
      setError(null);
    }
  }, [open, community.name, community.description]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      const updated = await updateCommunity.mutateAsync({
        name: name.trim(),
        description: description.trim(),
      });
      onOpenChange(false);
      onSuccess?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const submitting = updateCommunity.isPending;

  return (
    <DashboardModal open={open} onOpenChange={onOpenChange} title="Edit community">
      <form onSubmit={onSubmit} className="space-y-4 pt-2">
        <DashboardField label="Name" required>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={dashboardInputClass}
          />
        </DashboardField>

        <DashboardField label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={cn(dashboardInputClass, "resize-none")}
          />
        </DashboardField>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <DashboardPrimaryButton
          type="submit"
          disabled={submitting || !name.trim()}
          className="w-full"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save changes
        </DashboardPrimaryButton>
      </form>
    </DashboardModal>
  );
}
