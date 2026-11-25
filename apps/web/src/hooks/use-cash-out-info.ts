"use client";

import { useEffect, useState } from "react";
import { getCashOutInfo, peekCashOutInfo, type CashOutInfo } from "@/lib/cashout/availability";

const OFF: CashOutInfo = { enabled: false, inNigeria: false, nairaPerG: null };

/** Is cash out on here, is the player in Nigeria, and the live naira per G$. Shared, asked once per page view. */
export function useCashOutInfo(): CashOutInfo {
  const [info, setInfo] = useState<CashOutInfo>(() => peekCashOutInfo() ?? OFF);
  useEffect(() => {
    let cancelled = false;
    void getCashOutInfo().then((i) => { if (!cancelled) setInfo(i); });
    return () => { cancelled = true; };
  }, []);
  return info;
}
