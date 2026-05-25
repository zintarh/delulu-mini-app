"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClaimPanel } from "@/contexts/right-panel-context";

/** Deep link: open the claim panel and return to home. */
export default function DailyClaimPage() {
  const router = useRouter();
  const { open } = useClaimPanel();

  useEffect(() => {
    open();
    router.replace("/");
  }, [open, router]);

  return null;
}
