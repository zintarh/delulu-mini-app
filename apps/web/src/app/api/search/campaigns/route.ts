import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 20;

export type CampaignSearchResult = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  display_ends_at: string | null;
  duration_days: number;
  is_free_to_join: boolean;
  community_name: string;
  community_slug: string;
};

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ results: [] });

  const pattern = `%${q}%`;

  const { data, error } = await admin
    .from("community_campaigns")
    .select(
      "id, title, description, cover_image_url, display_ends_at, duration_days, is_free_to_join, communities ( name, slug )",
    )
    .neq("status", "draft")
    .or(`title.ilike.${pattern},description.ilike.${pattern}`)
    .order("created_at", { ascending: false })
    .limit(MAX_RESULTS);

  if (error) return NextResponse.json({ results: [] });

  const results: CampaignSearchResult[] = (data ?? []).map((row) => {
    const community = (Array.isArray(row.communities) ? row.communities[0] : row.communities) as { name: string; slug: string } | null;
    return {
      id: String(row.id),
      title: String(row.title),
      description: (row.description as string | null) ?? null,
      cover_image_url: (row.cover_image_url as string | null) ?? null,
      display_ends_at: (row.display_ends_at as string | null) ?? null,
      duration_days: Number(row.duration_days ?? 30),
      is_free_to_join: row.is_free_to_join !== false,
      community_name: community?.name ?? "",
      community_slug: community?.slug ?? "",
    };
  });

  return NextResponse.json({ results });
}
