import { NextRequest, NextResponse } from "next/server";
import { banks, cashOutEnabled, gc, gcConfig, type GcLimits } from "@/lib/cashout/goodcash-server";
import { MAX_WITHDRAW_G } from "@/lib/cashout/goodcash";

export const dynamic = "force-dynamic";

let reach: { at: number; ok: boolean } | null = null;
async function reachable(): Promise<boolean> {
  if (reach && Date.now() - reach.at < (reach.ok ? 300_000 : 60_000)) return reach.ok;
  const r = await gc<GcLimits>("/v1/limits", { timeoutMs: 6000 });
  reach = { at: Date.now(), ok: r.ok };
  return r.ok;
}

// GET /api/cashout/setup → everything the cash-out sheet needs to open:
// whether it's on, the limits and the banks.
// GET /api/cashout/setup?probe=1 → just "is it on, and where is this visitor?"
export async function GET(req: NextRequest) {
  if (!cashOutEnabled()) return NextResponse.json({ enabled: false });
  if (req.nextUrl.searchParams.has("probe")) {
    // Cash out pays Nigerian bank accounts only. Vercel tells us the visitor's
    // country; the app also checks the device time zone when it's missing.
    const country = req.headers.get("x-vercel-ip-country");
    return NextResponse.json({ enabled: await reachable(), country }, { headers: { "Cache-Control": "private, max-age=60" } });
  }

  const [limits, bankList] = await Promise.all([gc<GcLimits>("/v1/limits"), banks()]);
  if (!limits.ok || !bankList.ok) {
    const message = !limits.ok ? limits.error.message : !bankList.ok ? bankList.error.message : "";
    return NextResponse.json({ enabled: true, error: message }, { status: 503 });
  }

  return NextResponse.json({
    enabled: true,
    mode: gcConfig()!.mode,
    minimumG: limits.data.minimumG,
    maximumG: Math.min(limits.data.maximumG, MAX_WITHDRAW_G),
    feePercent: limits.data.feePercent,
    banks: bankList.data,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
