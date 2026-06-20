import { NextRequest, NextResponse } from "next/server";
import { PARTICIPATING_STATUSES } from "@/lib/community/campaign-types";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: community } = await admin
    .from("communities")
    .select("id, name, slug, description, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!community) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (community.status !== "active") {
    return NextResponse.json({ error: "Community is not active" }, { status: 403 });
  }

  const { data: campaigns, error } = await admin
    .from("community_campaigns")
    .select(`
      id, title, description, proof_cadence, proof_instructions,
      proposed_pool_amount, status, display_ends_at, created_at
    `)
    .eq("community_id", community.id)
    .in("status", [...PARTICIPATING_STATUSES])
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ community, campaigns: campaigns ?? [] });
}
