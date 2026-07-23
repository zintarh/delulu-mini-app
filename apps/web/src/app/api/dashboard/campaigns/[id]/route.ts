import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { logCampaignEvent } from "@/lib/dashboard/log-campaign-event";
import {
  parseDurationDays,
  parsePrizeWinnerCount,
  parseProofType,
  parseLiveCameraDurationSeconds,
} from "@/lib/community/campaign-types";
import { canDeleteDashboardCampaign } from "@/lib/dashboard/campaign-constants";
import { fetchCommunityCampaignLeaderboardFromGraph } from "@/lib/community/campaign-subgraph";
import { enrichLeaderboardWithUsernames } from "@/lib/community/enrich-leaderboard-usernames";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

const CAMPAIGN_DETAIL_SELECT = `
  id, community_id, title, description, proof_cadence, proof_instructions,
  content_hash, proposed_pool_amount, on_chain_challenge_id, status,
  display_ends_at, duration_days, prize_winner_count, cover_image_url,
  is_free_to_join, join_token, join_amount, forfeit_pct,
  proof_type, live_camera_duration_seconds, is_hidden,
  rejection_reason, approved_at, created_at, updated_at,
  payout_merkle_root, payout_published_at, payout_total_claimable_wei,
  communities ( id, name, slug, member_invite_code )
`;

async function canAccessCampaign(
  session: NonNullable<Awaited<ReturnType<typeof readAdminSession>>>,
  communityId: string,
) {
  if (isPlatformAdminRole(session.staffRole)) return true;
  return session.communityIds.includes(communityId);
}

const EDITABLE_STATUSES = new Set(["draft", "rejected", "pending_approval"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign, error } = await admin
    .from("community_campaigns")
    .select(CAMPAIGN_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAccessCampaign(session, campaign.community_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: participants } = await admin
    .from("campaign_participants")
    .select("id, wallet_address, points_total, current_streak, joined_at")
    .eq("campaign_id", id)
    .eq("status", "joined")
    .order("points_total", { ascending: false })
    .limit(50);

  let leaderboard = participants ?? [];

  if (campaign.on_chain_challenge_id != null) {
    const { data: members } = await admin
      .from("community_members")
      .select("wallet_address")
      .eq("community_id", campaign.community_id)
      .eq("status", "active");

    const memberWallets = new Set(
      (members ?? []).map((m) => m.wallet_address.toLowerCase()),
    );

    const graphRows = await fetchCommunityCampaignLeaderboardFromGraph(
      campaign.on_chain_challenge_id,
      memberWallets,
    );

    leaderboard = graphRows.map((row) => ({
      id: null,
      wallet_address: row.wallet_address,
      points_total: row.points_total,
      current_streak: row.current_streak,
      joined_at: row.joined_at,
      username: row.username ?? null,
    }));
  }

  leaderboard = await enrichLeaderboardWithUsernames(admin, leaderboard);

  return NextResponse.json({ campaign, leaderboard });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: existing, error: fetchError } = await admin
    .from("community_campaigns")
    .select("id, community_id, status, proof_type")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAccessCampaign(session, existing.community_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const canEditMetadata = EDITABLE_STATUSES.has(existing.status);
  const canEditCover = existing.status !== "ended";

  // Hiding is a visibility-only toggle — allowed regardless of status/edit-lock state.
  if (
    !canEditCover &&
    !canEditMetadata &&
    body.isHidden === undefined
  ) {
    return NextResponse.json({ error: "Campaign cannot be edited" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let metadataEdited = false;

  if (body.isHidden !== undefined) {
    updates.is_hidden = Boolean(body.isHidden);
  }

  if (body.coverImageUrl !== undefined) {
    if (!canEditCover) {
      return NextResponse.json({ error: "Cover image cannot be changed" }, { status: 400 });
    }
    updates.cover_image_url =
      body.coverImageUrl != null && String(body.coverImageUrl).trim()
        ? String(body.coverImageUrl).trim()
        : null;
  }

  if (canEditMetadata) {
    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
      updates.title = title;
      metadataEdited = true;
    }
    if (body.proofCadence !== undefined) {
      updates.proof_cadence = body.proofCadence === "weekly" ? "weekly" : "daily";
      metadataEdited = true;
    }
    if (body.proofInstructions !== undefined) {
      updates.proof_instructions = String(body.proofInstructions).trim() || null;
      metadataEdited = true;
    }
    if (body.durationDays !== undefined) {
      updates.duration_days = parseDurationDays(body.durationDays);
      metadataEdited = true;
    }
    if (body.prizeWinnerCount !== undefined) {
      updates.prize_winner_count = parsePrizeWinnerCount(body.prizeWinnerCount);
      metadataEdited = true;
    }
    if (body.proofType !== undefined || body.liveCameraDurationMinutes !== undefined) {
      const effectiveProofType =
        body.proofType !== undefined ? parseProofType(body.proofType) : parseProofType(existing.proof_type);
      updates.proof_type = effectiveProofType;
      updates.live_camera_duration_seconds =
        effectiveProofType === "live_camera"
          ? parseLiveCameraDurationSeconds(body.liveCameraDurationMinutes)
          : null;
      metadataEdited = true;
    }
  } else if (
    body.title !== undefined ||
    body.proofCadence !== undefined ||
    body.proofInstructions !== undefined ||
    body.durationDays !== undefined ||
    body.prizeWinnerCount !== undefined ||
    body.proofType !== undefined ||
    body.liveCameraDurationMinutes !== undefined
  ) {
    return NextResponse.json(
      { error: "Only draft, rejected or pending campaigns can edit metadata" },
      { status: 400 },
    );
  }

  if (metadataEdited) {
    updates.content_hash = null;
    if (existing.status === "rejected") {
      updates.status = "draft";
      updates.rejection_reason = null;
    }
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: campaign, error } = await admin
    .from("community_campaigns")
    .update(updates)
    .eq("id", id)
    .select(CAMPAIGN_DETAIL_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logCampaignEvent(id, "updated", session.userId, updates);

  return NextResponse.json({ campaign });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: existing, error: fetchError } = await admin
    .from("community_campaigns")
    .select("id, community_id, status, title")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAccessCampaign(session, existing.community_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!canDeleteDashboardCampaign(existing.status)) {
    return NextResponse.json(
      { error: "Only unfunded campaigns can be deleted." },
      { status: 400 },
    );
  }

  const { error } = await admin.from("community_campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logCampaignEvent(id, "deleted", session.userId, { title: existing.title });

  return NextResponse.json({ ok: true });
}
