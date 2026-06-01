"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/hooks/use-auth";

interface NotificationCountContextValue {
  unreadCount: number;
  clearUnread: () => void;
  refresh: () => void;
}

const NotificationCountContext = createContext<NotificationCountContextValue>({
  unreadCount: 0,
  clearUnread: () => {},
  refresh: () => {},
});

export function useNotificationCount() {
  return useContext(NotificationCountContext);
}

export function NotificationCountProvider({ children }: { children: React.ReactNode }) {
  const { address, authenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCount = useCallback(async () => {
    if (!address || !authenticated) return;
    try {
      const res = await fetch(`/api/notifications?address=${address}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unread_count ?? 0);
    } catch {}
  }, [address, authenticated]);

  const clearUnread = useCallback(() => setUnreadCount(0), []);
  const refresh = useCallback(() => { void fetchCount(); }, [fetchCount]);

  useEffect(() => {
    if (!address || !authenticated) {
      setUnreadCount(0);
      return;
    }
    void fetchCount();
    intervalRef.current = setInterval(fetchCount, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [address, authenticated, fetchCount]);

  return (
    <NotificationCountContext.Provider value={{ unreadCount, clearUnread, refresh }}>
      {children}
    </NotificationCountContext.Provider>
  );
}
