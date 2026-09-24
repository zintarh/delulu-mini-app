import { NextRequest, NextResponse } from "next/server";
import { fetchJoinedCampaignDashboard } from "@/lib/community/joined-dashboard";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic"; // per-user data, must stay dynamic

/** Home / profile "active campaigns". */
export async function GET(request: NextRequest) {
  const address = new URL(request.url).searchParams.get("address")?.trim().toLowerCase();
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  return NextResponse.json({ campaigns: await fetchJoinedCampaignDashboard(admin, address) });
}
