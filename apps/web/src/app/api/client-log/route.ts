import { NextRequest } from "next/server";
import { getAuthenticatedWallet } from "@/lib/auth/wallet-session";
import { jsonResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Client-side wallet failures, written to the function log (see lib/client-error.ts). */
export async function POST(request: NextRequest) {
  const text = await request.text().catch(() => "");
  if (!text || text.length > 4_000) return jsonResponse({ ok: false }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false }, { status: 400 });
  }
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(body).slice(0, 15)) {
    if (v === null || typeof v === "number" || typeof v === "boolean") clean[k.slice(0, 30)] = v;
    else if (typeof v === "string") clean[k.slice(0, 30)] = v.slice(0, 500);
  }
  const wallet = getAuthenticatedWallet(request);
  console.error("[client-error]", JSON.stringify({ wallet: wallet?.toLowerCase() ?? null, ...clean }));
  return jsonResponse({ ok: true });
}
