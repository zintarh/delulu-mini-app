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
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export type DashboardCampaign = {
  id: string;
  community_id: string;
  title: string;
  description: string | null;
  proof_cadence: string;
  proof_instructions: string | null;
  content_hash: string | null;
  proposed_pool_amount: number;
  on_chain_challenge_id: number | null;
  status: string;
  display_ends_at: string | null;
  duration_days: number;
  prize_winner_count: number;
  cover_image_url: string | null;
  proof_type: string;
  live_camera_duration_seconds: number | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  community?: { id: string; name: string; slug: string } | null;
  proposer?: { email: string; display_name: string | null } | null;
  participant_count?: number;
};

function normalizeCampaign(row: Record<string, unknown>): DashboardCampaign {
  return {
    id: String(row.id),
    community_id: String(row.community_id),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    proof_cadence: String(row.proof_cadence ?? "daily"),
    proof_instructions: (row.proof_instructions as string | null) ?? null,
    content_hash: (row.content_hash as string | null) ?? null,
    proposed_pool_amount: Number(row.proposed_pool_amount ?? 0),
    on_chain_challenge_id:
      row.on_chain_challenge_id != null ? Number(row.on_chain_challenge_id) : null,
    status: String(row.status),
    display_ends_at: (row.display_ends_at as string | null) ?? null,
    duration_days: Number(row.duration_days ?? 30),
    prize_winner_count: Number(row.prize_winner_count ?? 10),
    cover_image_url: (row.cover_image_url as string | null) ?? null,
    proof_type: String(row.proof_type ?? "screenshot"),
    live_camera_duration_seconds:
      row.live_camera_duration_seconds != null ? Number(row.live_camera_duration_seconds) : null,
    is_hidden: Boolean(row.is_hidden),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    community: row.communities as DashboardCampaign["community"],
    proposer: row.proposer as DashboardCampaign["proposer"],
    participant_count: row.participant_count as number | undefined,
  };
}

const CAMPAIGN_SELECT = `
  id, community_id, title, description, proof_cadence, proof_instructions,
  content_hash, proposed_pool_amount, on_chain_challenge_id, status,
  display_ends_at, duration_days, prize_winner_count, cover_image_url,
  is_free_to_join, join_token, join_amount, forfeit_pct,
  proof_type, live_camera_duration_seconds, is_hidden,
  created_at, updated_at,
  communities ( id, name, slug )
`;

// GET — paginated campaign list (optional filters: communityId, status, query)
export async function GET(request: NextRequest) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const communityId = searchParams.get("communityId");
  const status = searchParams.get("status");
  const searchQuery = searchParams.get("query")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const isPlatformAdmin = isPlatformAdminRole(session.staffRole);

  let query = admin
    .from("community_campaigns")
    .select(CAMPAIGN_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  if (communityId) {
    if (!isPlatformAdmin && !session.communityIds.includes(communityId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    query = query.eq("community_id", communityId);
  } else if (!isPlatformAdmin) {
    if (session.communityIds.length === 0) {
      return NextResponse.json({ campaigns: [], total: 0, page: 1, pageSize: PAGE_SIZE });
    }
    query = query.in("community_id", session.communityIds);
  }

  if (status) query = query.eq("status", status);
  if (searchQuery) query = query.ilike("title", `%${searchQuery}%`);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const campaigns = (data ?? []).map((row) => normalizeCampaign(row as Record<string, unknown>));
  return NextResponse.json({ campaigns, total: count ?? campaigns.length, page, pageSize: PAGE_SIZE });
}

// POST — create draft campaign
export async function POST(request: NextRequest) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const communityId = String(body.communityId ?? "").trim();
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim() || null;
  const proofCadence = body.proofCadence === "weekly" ? "weekly" : "daily";
  const proofInstructions = String(body.proofInstructions ?? "").trim() || null;
  const durationDays = parseDurationDays(body.durationDays);
  const prizeWinnerCount = parsePrizeWinnerCount(body.prizeWinnerCount);
  const proofType = parseProofType(body.proofType);
  const liveCameraDurationSeconds =
    proofType === "live_camera" ? parseLiveCameraDurationSeconds(body.liveCameraDurationMinutes) : null;
  const coverImageUrl =
    body.coverImageUrl != null && String(body.coverImageUrl).trim()
      ? String(body.coverImageUrl).trim()
      : null;

  if (!communityId) return NextResponse.json({ error: "communityId is required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const poolAmount =
    body.proposedPoolAmount != null && Number.isFinite(Number(body.proposedPoolAmount))
      ? Math.max(0, Number(body.proposedPoolAmount))
      : 0;

  const isPlatformAdmin = isPlatformAdminRole(session.staffRole);
  if (!isPlatformAdmin && !session.communityIds.includes(communityId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const isFreeToJoin = body.isFreeToJoin !== false;
  const joinToken = isFreeToJoin ? "G$" : (String(body.joinToken ?? "G$").trim() || "G$");
  const joinAmount = isFreeToJoin ? 0 : Math.max(0, Number(body.joinAmount) || 0);
  const forfeitPct = isFreeToJoin ? 0 : ([0, 2, 5, 10].includes(Number(body.forfeitPct)) ? Number(body.forfeitPct) : 0);
  const telegramLink =
    body.telegramLink && typeof body.telegramLink === "string" && body.telegramLink.startsWith("https://t.me/")
      ? body.telegramLink.trim()
      : null;

  const milestones: { title: string; duration_days: number; order_index: number }[] =
    Array.isArray(body.milestones)
      ? body.milestones
          .filter((m: unknown) => m && typeof (m as Record<string, unknown>).title === "string" && (m as Record<string, unknown>).title)
          .map((m: Record<string, unknown>, i: number) => ({
            title: String(m.title).slice(0, 200).trim(),
            duration_days: Math.max(1, Number(m.duration_days) || 7),
            order_index: typeof m.order_index === "number" ? m.order_index : i,
          }))
      : [];

  const { data, error } = await admin
    .from("community_campaigns")
    .insert({
      community_id: communityId,
      proposed_by: session.userId,
      title,
      description,
      proof_cadence: proofCadence,
      proof_instructions: proofInstructions,
      proposed_pool_amount: poolAmount,
      duration_days: durationDays,
      prize_winner_count: prizeWinnerCount,
      cover_image_url: coverImageUrl,
      proof_type: proofType,
      live_camera_duration_seconds: liveCameraDurationSeconds,
      is_free_to_join: isFreeToJoin,
      join_token: joinToken,
      join_amount: joinAmount,
      forfeit_pct: forfeitPct,
      telegram_link: telegramLink,
      status: "draft",
    })
    .select(CAMPAIGN_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (milestones.length > 0) {
    const { error: milestonesError } = await admin.from("campaign_milestones").insert(
      milestones.map((m) => ({ ...m, campaign_id: data.id })),
    );
    if (milestonesError) {
      console.error("[campaigns] milestones insert error:", milestonesError);
      return NextResponse.json({ error: milestonesError.message }, { status: 500 });
    }
  }

  await logCampaignEvent(data.id, "created", session.userId, { status: "draft" });

  return NextResponse.json({ campaign: normalizeCampaign(data as Record<string, unknown>) }, { status: 201 });
}
