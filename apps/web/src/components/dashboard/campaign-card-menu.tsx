"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { canDeleteDashboardCampaign } from "@/lib/dashboard/campaign-constants";

export function CampaignCardMenu({
  campaignId,
  communityId,
  status,
  title,
  onRequestDelete,
}: {
  campaignId: string;
  communityId: string;
  status: string;
  title: string;
  onRequestDelete?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const canDelete = canDeleteDashboardCampaign(status);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Campaign actions"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[#f9f8f4] hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[8.5rem] overflow-hidden rounded-xl border border-[#e8e8e3] bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-[#f9f8f4]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              close();
              router.push(
                `/dashboard/communities/${communityId}/campaigns/${campaignId}?tab=settings`,
              );
            }}
          >
            Edit
          </button>
          {canDelete ? (
            <button
              type="button"
              role="menuitem"
              className={cn(
                "flex w-full px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-red-50",
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                close();
                onRequestDelete?.();
              }}
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
