"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditDeluluMetadata, useDeleteDeluluMetadata } from "@/hooks/use-delulu-metadata";
import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/ui/modal";

export type EditSheetMode = "update" | "hide";

interface EditDeluluSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode?: EditSheetMode;
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
  mode = "update",
  onChainId,
  creatorAddress,
  currentTitle,
  currentDescription,
  currentImage,
  onDeleted,
}: EditDeluluSheetProps) {
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync props to state when modal opens
  useEffect(() => {
    if (open) {
      setTitle(currentTitle);
      setDescription(currentDescription);
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
        <ModalContent className="max-w-md bg-secondary border-border/70 shadow-2xl">
          <ModalHeader>
            <ModalTitle style={{ fontFamily: '"Clash Display", sans-serif' }}>
              {mode === "hide" ? "Delete" : "Update"}
            </ModalTitle>
          </ModalHeader>

          {/* Update mode */}
          {mode === "update" && (
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
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border focus:border-foreground/30 transition-all"
                  placeholder="Delulu title"
                  autoFocus
                  style={{ fontFamily: "var(--font-manrope)" }}
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
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-border focus:border-foreground/30 transition-all"
                  placeholder="What does this delulu mean to you?"
                  style={{ fontFamily: "var(--font-manrope)" }}
                />
              </div>

              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-manrope)" }}>
                  Deadline, stake, and on-chain data cannot be edited. Those are permanent.
                </p>
              </div>

              {edit.isError && (
                <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2">
                  <p className="text-xs text-destructive" style={{ fontFamily: "var(--font-manrope)" }}>
                    {(edit.error as Error)?.message || "Failed to update"}
                  </p>
                </div>
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
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                {edit.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating…
                  </span>
                ) : (
                  "Update"
                )}
              </button>
            </div>
          )}

          {/* Hide mode */}
          {mode === "hide" && (
            <div className="space-y-4">
              {!showDeleteConfirm ? (
                <>
                  <div className="bg-destructive/10 border border-destructive/25 rounded-xl px-4 py-3 space-y-1.5">
                    <p className="text-sm font-semibold text-destructive" style={{ fontFamily: '"Clash Display", sans-serif' }}>
                      Hide this delulu?
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed" style={{ fontFamily: "var(--font-manrope)" }}>
                      This removes this delulu from feed and search.
                      The on-chain record remains permanent and cannot be deleted.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-3.5 rounded-xl font-bold text-sm text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
                    style={{ fontFamily: "var(--font-manrope)" }}
                  >
                    Delete
                  </button>

                  <button
                    onClick={() => onOpenChange(false)}
                    className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    style={{ fontFamily: "var(--font-manrope)" }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5">
                    <p className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-manrope)" }}>
                      Are you sure? This action hides this delulu from public feed and search.
                    </p>
                  </div>

                  {del.isError && (
                    <p className="text-xs text-destructive">
                      {(del.error as Error)?.message || "Failed to hide delulu"}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-3 rounded-xl bg-background/80 border border-border/70 text-sm font-semibold hover:bg-background transition-colors"
                      style={{ fontFamily: "var(--font-manrope)" }}
                    >
                      Go back
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={del.isPending}
                      className="flex-1 py-3 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold flex items-center justify-center gap-2 hover:bg-destructive/90 transition-colors"
                      style={{ fontFamily: "var(--font-manrope)" }}
                    >
                      {del.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Hide delulu
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
