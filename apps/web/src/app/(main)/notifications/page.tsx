"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNotificationsPanel } from "@/contexts/right-panel-context";

/** Deep link: open the updates panel and return to home. */
export default function NotificationsPage() {
  const router = useRouter();
  const { open } = useNotificationsPanel();

  useEffect(() => {
    open();
    router.replace("/");
  }, [open, router]);

  return null;
}
