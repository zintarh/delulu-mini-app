import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { ipSubnet } from "@/lib/faucet/rules";

export const dynamic = "force-dynamic";

/** Normalised value for a kind, or null if it isn't valid for it. */
function normalise(kind: string, raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (kind === "address") return isAddress(v) ? v : null;
  if (kind === "ip") return /^[0-9a-f:.]{2,45}$/.test(v) && ipSubnet(v) ? v : null;
  if (kind === "subnet") {
    // Accept a subnet as shown in the claims table, or any IP inside it.
    if (/\/(24|48)$/.test(v)) return v;
    return ipSubnet(v);
  }
  return null;
}

/** POST /api/dashboard/faucet/blocklist — { kind: "address"|"ip"|"subnet", value, reason? } */
export async function POST(request: NextRequest) {
  const { session, error: authError } = await requirePlatformAdmin();
  if (authError) return authError;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { kind?: unknown; value?: unknown; reason?: unknown };
  const kind = typeof body.kind === "string" ? body.kind : "";
  const value = typeof body.value === "string" ? normalise(kind, body.value) : null;
  if (!value) return NextResponse.json({ error: "Enter a valid wallet address, IP or network range." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) || null : null;

  const { error } = await admin
    .from("faucet_blocklist")
    .upsert({ kind, value, reason, created_by: session.email ?? session.userId ?? null }, { onConflict: "kind,value" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, value });
}

/** DELETE /api/dashboard/faucet/blocklist?id=… */
export async function DELETE(request: NextRequest) {
  const { error: authError } = await requirePlatformAdmin();
  if (authError) return authError;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const { error } = await admin.from("faucet_blocklist").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
