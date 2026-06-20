"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DashboardModal,
  DashboardField,
  DashboardPrimaryButton,
  dashboardInputClass,
} from "@/components/dashboard/dashboard-ui";
import {
  useCreateCommunity,
  type DashboardCommunity,
} from "@/hooks/dashboard/use-dashboard-communities";

export function CreateCommunityModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (community: DashboardCommunity) => void;
}) {
  const createCommunity = useCreateCommunity();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setShowMore(false);
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      const community = await createCommunity.mutateAsync({
        name: name.trim(),
        description: description.trim(),
      });
      onOpenChange(false);
      reset();
      onSuccess?.(community);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const submitting = createCommunity.isPending;

  return (
    <DashboardModal
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="New community"
    >
      <form onSubmit={onSubmit} className="space-y-4 pt-2">
        <DashboardField label="Name" required>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Lagos Fitness Club"
            className={dashboardInputClass}
          />
        </DashboardField>

        {!showMore ? (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="text-xs font-semibold text-delulu-blue hover:underline"
          >
            + Description
          </button>
        ) : (
          <DashboardField label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={cn(dashboardInputClass, "resize-none")}
            />
          </DashboardField>
        )}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <DashboardPrimaryButton
          type="submit"
          disabled={submitting || !name.trim()}
          className="w-full"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create
        </DashboardPrimaryButton>
      </form>
    </DashboardModal>
  );
}
