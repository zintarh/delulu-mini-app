import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import {
  CommunityJoinError,
  lookupCommunityByInviteCode,
  upsertCommunityMember,
} from "@/lib/community/join-member";
import {
  requireAuthenticatedWallet,
  walletAuthErrorResponse,
} from "@/lib/auth/wallet-session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const walletAddress = String(body.walletAddress ?? "").trim().toLowerCase();
  const inviteCode = String(body.inviteCode ?? "").trim().toUpperCase();

  try {
    requireAuthenticatedWallet(request, walletAddress);
  } catch (err) {
    return walletAuthErrorResponse(err);
  }

  if (!walletAddress) return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  if (!inviteCode) return NextResponse.json({ error: "inviteCode is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  try {
    const community = await lookupCommunityByInviteCode(admin, inviteCode);
    if (!community) return NextResponse.json({ error: "Invalid invite code." }, { status: 404 });
    if (community.status !== "active") {
      return NextResponse.json({ error: "This community is no longer active." }, { status: 403 });
    }

    await upsertCommunityMember(admin, {
      communityId: community.id,
      walletAddress,
      joinedVia: "invite_code",
    });

    return NextResponse.json({
      ok: true,
      community: { id: community.id, name: community.name, slug: community.slug },
    });
  } catch (err) {
    if (err instanceof CommunityJoinError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to join" },
      { status: 500 },
    );
  }
}
