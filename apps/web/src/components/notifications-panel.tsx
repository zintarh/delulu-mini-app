"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
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

function formatTimeAgo(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 4) return `${w}w`;
  return `${Math.floor(d / 30)}mo`;
}

function renderMessage(message: string) {
  const parts = message.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <span key={i} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function NotificationItem({ item }: { item: NotificationRow }) {
  const isUnread = !item.read_at;

  const inner = (
    <li
      className={cn(
        "flex gap-3.5 py-3 px-3 rounded-xl transition-colors",
        isUnread ? "bg-secondary/60" : "hover:bg-muted/30",
      )}
    >
      <div className="shrink-0 relative">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="w-11 h-11 rounded-full object-cover bg-secondary"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center">
            <Bell className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
          </div>
        )}
        {isUnread && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-blue-500 border-2 border-background" />
        )}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className={cn("text-[14px] leading-snug pr-1", isUnread ? "text-foreground" : "text-foreground/80")}>
          {renderMessage(item.message)}
        </p>
        <span className="mt-1 block text-[11px] text-muted-foreground tabular-nums">
          {formatTimeAgo(item.created_at)}
        </span>
      </div>
    </li>
  );

  if (item.action_url) {
    return (
      <Link href={item.action_url} className="block -mx-1">
        {inner}
      </Link>
    );
  }
  return inner;
}

function SkeletonRow() {
  return (
    <li className="flex gap-3.5 py-3 px-3 animate-pulse">
      <div className="w-11 h-11 rounded-2xl bg-secondary shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 bg-secondary rounded w-4/5" />
        <div className="h-3 bg-secondary/70 rounded w-3/5" />
      </div>
    </li>
  );
}

function PanelContent({ onClose }: { onClose: () => void }) {
  const { address } = useAuth();
  const { clearUnread } = useNotificationCount();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
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
      setNotifications(data.notifications ?? []);
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

  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <>
      <div className="flex items-center justify-between px-5 pt-6 pb-3 shrink-0">
        <h2
          className="text-[28px] font-bold text-foreground tracking-tight"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Updates
        </h2>
        <div className="flex items-center gap-2">
          {hasUnread && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary"
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-full text-foreground hover:bg-secondary transition-colors"
            aria-label="Close updates"
          >
            <X className="w-6 h-6" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-8">
        {loading ? (
          <ul className="space-y-1">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
          </ul>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-4">
            <Bell className="w-10 h-10 text-muted-foreground/40" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-foreground">No notifications yet</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {notifications.map((item) => (
              <NotificationItem key={item.id} item={item} />
            ))}
          </ul>
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
          <aside className="relative w-full max-w-[400px] h-full bg-background shadow-xl flex flex-col animate-in slide-in-from-left duration-300">
            <PanelContent onClose={close} />
          </aside>
        </div>
      )}
    </>
  );
}
