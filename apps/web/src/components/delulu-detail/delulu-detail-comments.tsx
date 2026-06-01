"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { usePfps } from "@/hooks/use-profile-pfp";
import { cn, formatAddress } from "@/lib/utils";
import {
  DELULU_SOCIAL_UPDATED_EVENT,
  notifyDeluluSocialUpdated,
  type DeluluComment,
} from "@/lib/delulu-social-storage";

interface DeluluDetailCommentsProps {
  deluluId: number;
  deluluCreator?: string | null;
  userAddress?: string | null;
  username?: string | null;
  onRequireAuth: () => void;
  onCountChange?: (count: number) => void;
}

function commentUsername(displayName: string): string | null {
  const trimmed = displayName.trim();
  if (trimmed.startsWith("@") && trimmed.length > 1) return trimmed.slice(1);
  return null;
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export function DeluluDetailComments({
  deluluId,
  deluluCreator,
  userAddress,
  username,
  onRequireAuth,
  onCountChange,
}: DeluluDetailCommentsProps) {
  const [comments, setComments] = useState<DeluluComment[]>([]);
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/social/${deluluId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments ?? []);
      }
    } catch {
      // keep current state
    }
  }, [deluluId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    const onSocial = (e: Event) => {
      const detail = (e as CustomEvent<{ deluluId?: number }>).detail;
      if (detail?.deluluId != null && detail.deluluId !== deluluId) return;
      void loadComments();
    };
    window.addEventListener(DELULU_SOCIAL_UPDATED_EVENT, onSocial);
    return () => window.removeEventListener(DELULU_SOCIAL_UPDATED_EVENT, onSocial);
  }, [deluluId, loadComments]);

  useEffect(() => {
    onCountChange?.(comments.length);
  }, [comments.length, onCountChange]);

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text) return;
    if (!userAddress) {
      onRequireAuth();
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const displayName = username ? `@${username}` : formatAddress(userAddress);
      const res = await fetch(`/api/social/${deluluId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorAddress: userAddress.toLowerCase(),
          displayName,
          text,
          creatorAddress: deluluCreator ?? null,
        }),
      });
      if (res.ok) {
        setDraft("");
        await loadComments();
        notifyDeluluSocialUpdated(deluluId);
      } else {
        const err = await res.json().catch(() => ({}));
        setSubmitError((err as { error?: string }).error ?? "Failed to post comment. Try again.");
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!userAddress) return;
    setDeletingId(commentId);
    try {
      const res = await fetch(`/api/social/${deluluId}/comments/${commentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: userAddress.toLowerCase(),
          deluluCreator: deluluCreator?.toLowerCase() ?? null,
        }),
      });
      if (res.ok) {
        await loadComments();
        notifyDeluluSocialUpdated(deluluId);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const commentAuthorAddresses = useMemo(
    () => [...new Set(comments.map((c) => c.authorAddress.toLowerCase()))],
    [comments],
  );
  const authorPfps = usePfps(commentAuthorAddresses);

  const normalizedUser = userAddress?.toLowerCase() ?? null;
  const normalizedCreator = deluluCreator?.toLowerCase() ?? null;

  const canDelete = (c: DeluluComment) =>
    normalizedUser !== null &&
    (c.authorAddress === normalizedUser || normalizedUser === normalizedCreator);

  const canSend = draft.trim().length > 0 && !isSubmitting;

  return (
    <div className="flex flex-col">
      <div className="shrink-0 space-y-2">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-secondary/60 px-3 py-2.5 focus-within:ring-1 focus-within:ring-ring">
          <input
            id="delulu-comments-input"
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (submitError) setSubmitError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder={userAddress ? "Add a comment…" : "Sign in to comment…"}
            aria-label="Add a comment"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (!userAddress) { onRequireAuth(); return; }
              void handleSubmit();
            }}
            disabled={isSubmitting}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
              canSend
                ? "bg-foreground text-background hover:opacity-90"
                : "cursor-default text-muted-foreground/40",
            )}
            aria-label="Send comment"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>

        {submitError ? (
          <p className="text-xs text-destructive px-1">{submitError}</p>
        ) : null}
      </div>

      {comments.length > 0 ? (
        <ul className="mt-5 max-h-[min(50vh,420px)] space-y-4 overflow-y-auto overscroll-contain pr-1 scrollbar-hide">
          {comments.map((c) => (
            <li key={c.id} className="group flex gap-2.5">
              <UserAvatar
                address={c.authorAddress}
                username={commentUsername(c.displayName)}
                pfpUrl={authorPfps[c.authorAddress.toLowerCase()]}
                size={32}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="truncate text-sm font-bold text-foreground">
                      {c.displayName}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatRelativeTime(c.createdAt)}
                    </span>
                  </div>
                  {canDelete(c) && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
                      aria-label="Delete comment"
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
                <p className="mt-1 break-words text-sm leading-relaxed text-foreground">
                  {c.text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          No comments yet. Be the first to say something.
        </p>
      )}
    </div>
  );
}
