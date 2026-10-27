"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lulu } from "@/components/ds";
import { Check, ChevronLeft } from "lucide-react";
import { ICON_BUTTON_CLASS } from "@/components/page-back-header";
import { cn } from "@/lib/utils";
import { useNotificationsPanel } from "@/contexts/right-panel-context";
import { useNotificationCount } from "@/contexts/notification-count-context";
import { useAuth } from "@/hooks/use-auth";

type NotificationRow = {
  id: string;
  type: string;
  message: string;
  image_url: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

/** "19:00" today, "Thu" this week, "29 Sep" before that (design: Activity). */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isToday(iso)) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (Date.now() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Timeline dot color for a new item, by what it's about. */
function dotColor(item: NotificationRow): string {
  const t = `${item.type} ${item.message}`.toLowerCase();
  if (/verif|approv|kept|returned|claimed|reward/.test(t)) return "bg-[#17804A]";
  if (/deadline|left to|reminder|miss|forfeit|overdue|reject/.test(t)) return "bg-orange";
  return "bg-yellow";
}

function renderMessage(message: string) {
  const parts = message.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <b key={i}>{part.slice(2, -2)}</b>;
    }
    return <span key={i}>{part}</span>;
  });
}

function NotificationItem({ item, isNew }: { item: NotificationRow; isNew: boolean }) {
  const inner = (
    <>
      <span
        className={cn(
          "relative z-[1] mt-px h-[22px] w-[22px] shrink-0 rounded-full border-4 border-paper",
          isNew ? dotColor(item) : "bg-[#C9C9C2]",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className={cn("text-[15px] leading-[1.45]", isNew ? "font-semibold" : "font-normal")}>{renderMessage(item.message)}</div>
        <div className="label-mono mt-1 text-[10px] text-muted-foreground">{formatWhen(item.created_at)}</div>
      </div>
    </>
  );
  const cls = "relative flex animate-rise gap-4 py-3 text-ink no-underline";
  if (item.action_url) {
    return (
      <Link href={item.action_url} className={cls}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function SkeletonRow() {
  return (
    <div className="flex animate-pulse gap-4 py-3">
      <div className="h-[22px] w-[22px] shrink-0 rounded-full bg-line" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="h-3.5 w-4/5 rounded bg-line" />
        <div className="h-2.5 w-12 rounded bg-line" />
      </div>
    </div>
  );
}

function PanelContent({ onClose }: { onClose: () => void }) {
  const { address } = useAuth();
  const { clearUnread } = useNotificationCount();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Items that were unread when the panel opened keep their colored dot
  // even after the panel marks everything read.
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const markedReadRef = useRef(false);

  useEffect(() => {
    markedReadRef.current = false;
  }, [address]);

  const fetchNotifications = useCallback(async () => {
    if (!address) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?address=${address}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const rows: NotificationRow[] = data.notifications ?? [];
      setNotifications(rows);
      setNewIds((prev) => (prev.size > 0 ? prev : new Set(rows.filter((n) => !n.read_at).map((n) => n.id))));
    } catch {
      // silently degrade
    } finally {
      setLoading(false);
    }
  }, [address]);

  const markAllRead = useCallback(async () => {
    if (!address || markedReadRef.current) return;
    markedReadRef.current = true;
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    }).catch(() => {});
    // Optimistically mark all as read in local state
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
    );
    clearUnread();
  }, [address, clearUnread]);

  useEffect(() => {
    fetchNotifications();
    markAllRead();
  }, [fetchNotifications, markAllRead]);

  const today = notifications.filter((n) => isToday(n.created_at));
  const earlier = notifications.filter((n) => !isToday(n.created_at));

  return (
    <>
      <div className="shrink-0 px-5 pt-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} aria-label="Back" className={ICON_BUTTON_CLASS}>
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <button type="button" onClick={() => void markAllRead()} aria-label="Mark all read" className={ICON_BUTTON_CLASS}>
            <Check className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <div className="pt-4">
          {newIds.size > 0 ? <span className="label-mono block text-muted-foreground">{newIds.size} new</span> : null}
          <h2 className={cn("m-0 animate-rise text-2xl font-bold leading-[1.2] tracking-[-0.02em]", newIds.size > 0 && "mt-1")}>
            Activity
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pb-8 pt-6">
        {loading ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 px-4 text-center">
            <span>
              <Lulu size={64} />
            </span>
            <p className="text-sm font-semibold text-muted-foreground">Nothing here yet</p>
          </div>
        ) : (
          <div className="relative">
            <span className="absolute bottom-0 left-2.5 top-4 w-0.5 bg-line" aria-hidden />
            {today.length > 0 ? (
              <>
                <span className="label-mono ml-[38px] block text-muted-foreground">Today</span>
                {today.map((item) => (
                  <NotificationItem key={item.id} item={item} isNew={newIds.has(item.id)} />
                ))}
              </>
            ) : null}
            {earlier.length > 0 ? (
              <>
                <span className={cn("label-mono ml-[38px] block text-muted-foreground", today.length > 0 && "mt-4")}>Earlier</span>
                {earlier.map((item) => (
                  <NotificationItem key={item.id} item={item} isNew={newIds.has(item.id)} />
                ))}
              </>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}

export function NotificationsPanel() {
  const { isOpen, close } = useNotificationsPanel();

  return (
    <>
      {/* Desktop */}
      <aside
        aria-hidden={!isOpen}
        className={cn(
          "hidden lg:flex flex-col h-full shrink-0 bg-background border-r border-border overflow-hidden",
          "transition-[width] duration-300 ease-out",
          isOpen ? "w-[400px]" : "w-0 border-r-0",
        )}
      >
        <div className="w-[400px] h-full flex flex-col min-h-0">
          {isOpen && <PanelContent onClose={close} />}
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-[70] flex justify-start">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close updates"
            onClick={close}
          />
          <aside className="relative flex h-full w-full max-w-[400px] flex-col bg-paper shadow-xl animate-in slide-in-from-left duration-300">
            <PanelContent onClose={close} />
          </aside>
        </div>
      )}
    </>
  );
}
