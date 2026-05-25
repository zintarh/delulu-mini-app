import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: { deluluId: string } },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const deluluId = parseInt(params.deluluId, 10);
  if (isNaN(deluluId)) return NextResponse.json({ error: "Invalid deluluId" }, { status: 400 });

  const userAddress = req.nextUrl.searchParams.get("userAddress")?.toLowerCase() ?? null;

  const { count } = await supabase
    .from("delulu_likes")
    .select("*", { count: "exact", head: true })
    .eq("delulu_id", deluluId);

  let userReacted = false;
  if (userAddress) {
    const { data } = await supabase
      .from("delulu_likes")
      .select("id")
      .eq("delulu_id", deluluId)
      .eq("user_address", userAddress)
      .maybeSingle();
    userReacted = !!data;
  }

  return NextResponse.json({ count: count ?? 0, userReacted });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { deluluId: string } },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const deluluId = parseInt(params.deluluId, 10);
  if (isNaN(deluluId)) return NextResponse.json({ error: "Invalid deluluId" }, { status: 400 });

  const body = await req.json();
  const userAddress = typeof body.userAddress === "string" ? body.userAddress.toLowerCase() : null;
  if (!userAddress) return NextResponse.json({ error: "userAddress required" }, { status: 400 });

  const { data: existing } = await supabase
    .from("delulu_likes")
    .select("id")
    .eq("delulu_id", deluluId)
    .eq("user_address", userAddress)
    .maybeSingle();

  if (existing) {
    await supabase.from("delulu_likes").delete().eq("id", existing.id);
  } else {
    await supabase.from("delulu_likes").insert({ delulu_id: deluluId, user_address: userAddress });
  }

  const { count } = await supabase
    .from("delulu_likes")
    .select("*", { count: "exact", head: true })
    .eq("delulu_id", deluluId);

  return NextResponse.json({ count: count ?? 0, userReacted: !existing });
}
