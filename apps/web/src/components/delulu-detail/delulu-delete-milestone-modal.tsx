"use client";

import { Loader2 } from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { getContractErrorDisplay } from "@/lib/contract-error";

export function DeluluDeleteMilestoneModal({
  open,
  onOpenChange,
  milestoneLabel,
  deleteError,
  isSuccess,
  isDeleting,
  isConfirming,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestoneLabel: string | undefined;
  deleteError: Error | null;
  isSuccess: boolean;
  isDeleting: boolean;
  isConfirming: boolean;
  onConfirm: () => void;
}) {
  const busy = isDeleting || isConfirming;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle className="text-delulu-charcoal text-xl font-bold">
            Delete
          </ModalTitle>
          <ModalDescription className="mt-2">
            Can&apos;t be undone.
          </ModalDescription>
        </ModalHeader>
        <div className="mt-4 space-y-4">
          {milestoneLabel ? (
            <div className="p-3 bg-muted rounded-lg border border-border">
              <p className="text-sm font-semibold text-foreground">
                {milestoneLabel}
              </p>
            </div>
          ) : null}

          {deleteError ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 font-medium">
                {getContractErrorDisplay(deleteError).message}
              </p>
            </div>
          ) : null}

          {isSuccess ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600 font-medium">
                ✓ Milestone deleted successfully!
              </p>
            </div>
          ) : null}

          <ModalFooter>
            <div className="flex gap-3 w-full">
              <button
                type="button"
                disabled={busy}
                onClick={() => onOpenChange(false)}
                className="flex-1 px-4 py-2 text-sm font-semibold rounded-md border border-border bg-secondary text-muted-foreground hover:bg-secondary/80 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onConfirm}
                className={cn(
                  "flex-1 px-4 py-2 text-sm font-black rounded-md border-2 border-delulu-charcoal shadow-[2px_2px_0px_0px_#1a1a19]",
                  "bg-red-500 text-white hover:bg-red-600 hover:scale-[0.98] transition-all",
                  "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100",
                )}
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 inline-block animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Milestone"
                )}
              </button>
            </div>
          </ModalFooter>
        </div>
      </ModalContent>
    </Modal>
  );
}
