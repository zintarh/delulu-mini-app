import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { lookupCommunityByInviteCode } from "@/lib/community/join-member";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code?.trim()) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  try {
    const community = await lookupCommunityByInviteCode(admin, code);
    if (!community) {
      return NextResponse.json({ valid: false, error: "Invalid community code." }, { status: 404 });
    }
    if (community.status !== "active") {
      return NextResponse.json({ valid: false, error: "This community is no longer active." }, { status: 403 });
    }
    return NextResponse.json({
      valid: true,
      community: { id: community.id, name: community.name, slug: community.slug },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Validation failed" },
      { status: 500 },
    );
  }
}
