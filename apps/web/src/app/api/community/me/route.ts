import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("address")?.toLowerCase();
  if (!walletAddress) return NextResponse.json({ error: "address is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data, error } = await admin
    .from("community_members")
    .select("community_id, status, joined_at, communities(id, name, slug, member_invite_code, status)")
    .eq("wallet_address", walletAddress)
    .eq("status", "active")
    .order("joined_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const communities = (data ?? []).map((row: {
    community_id: string;
    status: string;
    joined_at: string;
    communities: unknown;
  }) => ({
    ...(row.communities as object),
    joined_at: row.joined_at,
  }));

  return NextResponse.json({ communities });
}
