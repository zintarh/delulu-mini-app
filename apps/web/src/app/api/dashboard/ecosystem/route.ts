import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { addDays, lagosToday, loadReport, refreshDay } from "@/lib/ecosystem/gd-share";
import { readSustainability } from "@/lib/celo/reward-vault-payout";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const SEASON_START = "2026-11-16";

/** GET ?from=YYYY-MM-DD&to=YYYY-MM-DD — stored daily G$ shares (default: season start → today). */
export async function GET(req: NextRequest) {
  const { error } = await requirePlatformAdmin();
  if (error) return error;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const sp = req.nextUrl.searchParams;
  const to = DAY_RE.test(sp.get("to") ?? "") ? sp.get("to")! : lagosToday();
  const from = DAY_RE.test(sp.get("from") ?? "") ? sp.get("from")! : SEASON_START;
  if (from > to) return NextResponse.json({ error: "from is after to" }, { status: 400 });
  if (Date.parse(to) - Date.parse(from) > 120 * 86_400_000) return NextResponse.json({ error: "At most 120 days at once" }, { status: 400 });
  try {
    const [report, sustainability] = await Promise.all([loadReport(admin, from, to), readSustainability().catch(() => null)]);
    return NextResponse.json({ ...report, sustainability }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/**
 * POST { action: "compute", day } — read one day from the chain and store it (about a minute).
 * POST { action: "save-project", name, addresses, isUs?, active? } — add or edit a project.
 * POST { action: "delete-project", name }
 */
export async function POST(req: NextRequest) {
  const { error } = await requirePlatformAdmin();
  if (error) return error;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const body = await req.json().catch(() => ({}));

  if (body.action === "compute") {
    const day = String(body.day ?? "");
    if (!DAY_RE.test(day) || day > lagosToday() || day < addDays(lagosToday(), -120)) {
      return NextResponse.json({ error: "Pick a day in the last 120 days" }, { status: 400 });
    }
    try {
      return NextResponse.json({ ok: true, network: await refreshDay(admin, day) });
    } catch (e) {
      console.error("[ecosystem] compute failed", day, e);
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
    }
  }

  if (body.action === "save-project") {
    const name = String(body.name ?? "").trim();
    const addresses: string[] = Array.isArray(body.addresses) ? body.addresses.map((a: unknown) => String(a).trim()).filter(Boolean) : [];
    if (!name || name.length > 60) return NextResponse.json({ error: "Give the project a name" }, { status: 400 });
    const bad = addresses.filter((a) => !ADDR_RE.test(a));
    if (bad.length) return NextResponse.json({ error: `Not a full address (0x + 40 characters): ${bad.join(", ")}` }, { status: 400 });
    if (!addresses.length) return NextResponse.json({ error: "Add at least one contract address" }, { status: 400 });
    const { data: existing } = await admin.from("gd_share_projects").select("sort").eq("name", name).maybeSingle();
    const { data: last } = await admin.from("gd_share_projects").select("sort").order("sort", { ascending: false }).limit(1).maybeSingle();
    const { error: dbError } = await admin.from("gd_share_projects").upsert({
      name,
      addresses: [...new Set(addresses.map((a) => a.toLowerCase()))].map((a) => addresses.find((x) => x.toLowerCase() === a)!),
      is_us: !!body.isUs,
      active: body.active !== false,
      sort: existing?.sort ?? (Number(last?.sort ?? 0) + 1),
      updated_at: new Date().toISOString(),
    }, { onConflict: "name" });
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete-project") {
    const name = String(body.name ?? "");
    const { error: dbError } = await admin.from("gd_share_projects").delete().eq("name", name);
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
