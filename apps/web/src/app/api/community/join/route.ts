import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const walletAddress = String(body.walletAddress ?? "").trim().toLowerCase();
  const inviteCode = String(body.inviteCode ?? "").trim().toUpperCase();

  if (!walletAddress) return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  if (!inviteCode) return NextResponse.json({ error: "inviteCode is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  // Look up community by invite code
  const { data: community } = await admin
    .from("communities")
    .select("id, name, slug, status")
    .eq("member_invite_code", inviteCode)
    .maybeSingle();

  if (!community) return NextResponse.json({ error: "Invalid invite code." }, { status: 404 });
  if (community.status !== "active") {
    return NextResponse.json({ error: "This community is no longer active." }, { status: 403 });
  }

  // Upsert community_members (wallet users don't need a profiles row — use lower address)
  const { error } = await admin.from("community_members").upsert(
    {
      community_id: community.id,
      wallet_address: walletAddress,
      status: "active",
      joined_via: "invite_code",
    },
    { onConflict: "community_id,wallet_address" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    community: { id: community.id, name: community.name, slug: community.slug },
  });
}
