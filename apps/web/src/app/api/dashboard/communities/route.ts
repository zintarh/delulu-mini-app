import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

function generateInviteCode(): string {
  return randomBytes(5).toString("hex").toUpperCase();
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// GET — list communities
export async function GET() {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const isPlatformAdmin = isPlatformAdminRole(session.staffRole);

  let query = admin
    .from("communities")
    .select("id, name, slug, description, member_invite_code, status, created_at")
    .order("created_at", { ascending: false });

  if (!isPlatformAdmin) {
    if (session.communityIds.length === 0) return NextResponse.json({ communities: [] });
    query = query.in("id", session.communityIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data ?? []).map((c: { id: string }) => c.id);
  const { data: counts } = ids.length
    ? await admin.from("community_members").select("community_id").in("community_id", ids).eq("status", "active")
    : { data: [] };

  const countMap: Record<string, number> = {};
  for (const row of counts ?? []) {
    countMap[row.community_id] = (countMap[row.community_id] ?? 0) + 1;
  }

  const communities = (data ?? []).map((c: { id: string; [key: string]: unknown }) => ({
    ...c,
    member_count: countMap[c.id] ?? 0,
  }));

  return NextResponse.json({ communities });
}

// POST — create community (platform admin only)
export async function POST(request: NextRequest) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isPlatformAdmin = isPlatformAdminRole(session.staffRole);
  if (!isPlatformAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim() || null;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const slug = slugify(name);
  const member_invite_code = generateInviteCode();

  const { data, error } = await admin
    .from("communities")
    .insert({ name, slug, description, member_invite_code, created_by: session.userId })
    .select("id, name, slug, member_invite_code, status, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A community with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ community: data }, { status: 201 });
}
