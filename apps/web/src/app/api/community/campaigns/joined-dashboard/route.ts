import { NextRequest, NextResponse } from "next/server";
import { fetchJoinedCampaignDashboardFromGraph } from "@/lib/community/campaign-subgraph";
import { isCampaignEndedByDate, PARTICIPATING_STATUSES } from "@/lib/community/campaign-types";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { unwrapRelation } from "@/lib/supabase/unwrap-relation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const address = new URL(request.url).searchParams.get("address")?.trim().toLowerCase();
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: rows } = await admin
    .from("community_campaigns")
    .select(`
      id, title, cover_image_url, display_ends_at, duration_days, on_chain_challenge_id,
      communities ( name, slug )
    `)
    .in("status", [...PARTICIPATING_STATUSES])
    .not("on_chain_challenge_id", "is", null);

  const challengeIdToCampaign = new Map<
    number,
    {
      id: string;
      title: string;
      community: { name: string; slug: string };
      cover_image_url: string | null;
      display_ends_at: string | null;
      duration_days: number;
    }
  >();

  for (const raw of rows ?? []) {
    const cid = (raw as { on_chain_challenge_id: number | null }).on_chain_challenge_id;
    if (cid == null) continue;
    const endsAt = (raw as { display_ends_at: string | null }).display_ends_at;
    if (isCampaignEndedByDate(endsAt)) continue;
    const community = unwrapRelation(
      (raw as { communities: { name: string; slug: string } | { name: string; slug: string }[] | null })
        .communities,
    );
    challengeIdToCampaign.set(cid, {
      id: (raw as { id: string }).id,
      title: (raw as { title: string }).title,
      community: { name: community?.name ?? "Community", slug: community?.slug ?? "" },
      cover_image_url: (raw as { cover_image_url: string | null }).cover_image_url,
      display_ends_at: endsAt,
      duration_days: Number((raw as { duration_days: number }).duration_days ?? 30),
    });
  }

  const campaigns = await fetchJoinedCampaignDashboardFromGraph(address, challengeIdToCampaign);

  return NextResponse.json({ campaigns });
}
