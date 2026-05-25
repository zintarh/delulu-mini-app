"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationsPanel } from "@/contexts/right-panel-context";
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

function NotificationRow({ item }: { item: NotificationRow }) {
  const inner = (
    <li className="flex gap-4 py-2">
      <div className="shrink-0">
        {item.image_url ? (
          <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-secondary">
            <Image
              src={item.image_url}
              alt=""
              width={48}
              height={48}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
            <Bell className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] leading-snug text-foreground/90 pr-1">
            {renderMessage(item.message)}
          </p>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {formatTimeAgo(item.created_at)}
          </span>
        </div>
      </div>
    </li>
  );

  if (item.action_url) {
    return (
      <Link href={item.action_url} className="block hover:bg-muted/30 rounded-xl -mx-2 px-2 transition-colors">
        {inner}
      </Link>
    );
  }
  return inner;
}

function SkeletonRow() {
  return (
    <li className="flex gap-4 py-2 animate-pulse">
      <div className="w-12 h-12 rounded-2xl bg-muted/40 shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 bg-muted/40 rounded w-4/5" />
        <div className="h-3 bg-muted/30 rounded w-3/5" />
      </div>
    </li>
  );
}

function PanelContent({ onClose }: { onClose: () => void }) {
  const { address } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const markedReadRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?address=${address}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch {
      // silently degrade — show empty state
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
  }, [address]);

  useEffect(() => {
    fetchNotifications();
    markAllRead();
  }, [fetchNotifications, markAllRead]);

  return (
    <>
      <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
        <h2
          className="text-[28px] font-bold text-foreground tracking-tight"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Updates
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-10 h-10 rounded-full text-foreground hover:bg-secondary transition-colors"
          aria-label="Close updates"
        >
          <X className="w-6 h-6" strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pb-8">
        {loading ? (
          <ul className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </ul>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-4">
            <Bell className="w-10 h-10 text-muted-foreground/40" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-foreground">No notifications yet</p>
          </div>
        ) : (
          <ul className="space-y-6">
            {notifications.map((item) => (
              <NotificationRow key={item.id} item={item} />
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
      {/* Desktop: panel left of main content */}
      <aside
        aria-hidden={!isOpen}
        className={cn(
          "hidden lg:flex flex-col h-full shrink-0 bg-background border-r border-border overflow-hidden",
          "transition-[width] duration-300 ease-out",
          isOpen ? "w-[400px]" : "w-0 border-r-0"
        )}
      >
        <div className="w-[400px] h-full flex flex-col min-h-0">
          {isOpen && <PanelContent onClose={close} />}
        </div>
      </aside>

      {/* Mobile: overlay drawer */}
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
