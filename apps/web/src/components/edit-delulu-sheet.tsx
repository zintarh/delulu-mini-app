"use client";

import { useState, useEffect } from "react";
import { Loader2, X, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditDeluluMetadata, useDeleteDeluluMetadata } from "@/hooks/use-delulu-metadata";
import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/ui/modal";

interface EditDeluluSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChainId: string;
  creatorAddress: string;
  currentTitle: string;
  currentDescription: string;
  currentImage?: string;
  onDeleted?: () => void;
}

export function EditDeluluSheet({
  open,
  onOpenChange,
  onChainId,
  creatorAddress,
  currentTitle,
  currentDescription,
  currentImage,
  onDeleted,
}: EditDeluluSheetProps) {
  const [tab, setTab] = useState<"edit" | "delete">("edit");
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync props to state when modal opens
  useEffect(() => {
    if (open) {
      setTitle(currentTitle);
      setDescription(currentDescription);
      setTab("edit");
      setShowDeleteConfirm(false);
    }
  }, [open, currentTitle, currentDescription]);

  const edit = useEditDeluluMetadata(onChainId);
  const del = useDeleteDeluluMetadata(onChainId);

  const handleSave = async () => {
    await edit.mutateAsync({
      creatorAddress,
      titleOverride: title.trim() || undefined,
      descriptionOverride: description.trim() || undefined,
    });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    await del.mutateAsync(creatorAddress);
    onOpenChange(false);
    onDeleted?.();
  };

  const isDirty =
    title.trim() !== currentTitle.trim() ||
    description.trim() !== currentDescription.trim();

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange}>
        <ModalContent className="max-w-md">
          <ModalHeader className="flex items-center justify-between pr-2">
            <ModalTitle>Edit goal</ModalTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </ModalHeader>

          {/* Tab bar */}
          <div className="flex gap-1 bg-muted rounded-xl p-1 mb-4">
            <button
              onClick={() => setTab("edit")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === "edit"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={() => setTab("delete")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === "delete"
                  ? "bg-background text-destructive shadow-sm"
                  : "text-muted-foreground hover:text-destructive"
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>

          {/* Edit tab */}
          {tab === "edit" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border transition-all"
                  placeholder="Goal title"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  Description{" "}
                  <span className="font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-border transition-all"
                  placeholder="What does this goal mean to you?"
                />
              </div>

              <p className="text-[10px] text-muted-foreground">
                Deadline, stake, and on-chain data cannot be edited — those are permanent.
              </p>

              {edit.isError && (
                <p className="text-xs text-destructive">
                  {(edit.error as Error)?.message || "Failed to save"}
                </p>
              )}

              <button
                onClick={handleSave}
                disabled={!isDirty || edit.isPending}
                className={cn(
                  "w-full py-3.5 rounded-xl font-bold text-sm transition-all",
                  "bg-delulu-yellow text-delulu-charcoal",
                  "active:scale-[0.98]",
                  (!isDirty || edit.isPending) && "opacity-40 cursor-not-allowed"
                )}
              >
                {edit.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </span>
                ) : (
                  "Save changes"
                )}
              </button>
            </div>
          )}

          {/* Delete tab */}
          {tab === "delete" && (
            <div className="space-y-4">
              {!showDeleteConfirm ? (
                <>
                  <div className="bg-destructive/10 border border-destructive/25 rounded-xl px-4 py-3 space-y-1">
                    <p className="text-sm font-semibold text-destructive">Hide this goal?</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This hides the goal from the feed and search. The on-chain record is permanent
                      and cannot be removed.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-3.5 rounded-xl font-bold text-sm text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
                  >
                    Yes, hide this goal
                  </button>

                  <button
                    onClick={() => onOpenChange(false)}
                    className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Are you sure? This action hides the goal from everyone.
                  </p>

                  {del.isError && (
                    <p className="text-xs text-destructive">
                      {(del.error as Error)?.message || "Failed to hide goal"}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-3 rounded-xl bg-muted text-sm font-semibold hover:bg-muted/80 transition-colors"
                    >
                      Go back
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={del.isPending}
                      className="flex-1 py-3 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold flex items-center justify-center gap-2 hover:bg-destructive/90 transition-colors"
                    >
                      {del.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Hide goal
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
