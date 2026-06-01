"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClaimPanel } from "@/contexts/right-panel-context";
import type { GoodDollarWhitelistAction } from "@/lib/gooddollar-whitelist";

/** Deep link: open the claim panel and return to home. ?from=tip|create shows whitelist context. */
export default function DailyClaimPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { open, openForWhitelist } = useClaimPanel();

  useEffect(() => {
    const from = searchParams.get("from");
    if (from === "tip" || from === "create") {
      openForWhitelist(from as GoodDollarWhitelistAction);
    } else {
      open();
    }
    router.replace("/");
  }, [open, openForWhitelist, router, searchParams]);

  return null;
}
