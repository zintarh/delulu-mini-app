import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { createNotification } from "@/lib/notifications";

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

  return NextResponse.json({ count: count ?? 0, userReacted }, {
    headers: { "Cache-Control": "no-store" },
  });
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
  const creatorAddress = typeof body.creatorAddress === "string" ? body.creatorAddress.toLowerCase() : null;

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

    // Notify creator on new like (skip if liker is the creator)
    if (creatorAddress && creatorAddress !== userAddress) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, pfp_url")
        .eq("address", userAddress)
        .maybeSingle();
      const displayName = profile?.username
        ? `@${profile.username}`
        : `${userAddress.slice(0, 6)}…${userAddress.slice(-4)}`;
      await createNotification({
        recipientAddress: creatorAddress,
        type: "like",
        message: `**${displayName}** liked your delulu`,
        actorAddress: userAddress,
        imageUrl: profile?.pfp_url ?? null,
        actionUrl: `/delulu/${deluluId}`,
      });
    }
  }

  const { count } = await supabase
    .from("delulu_likes")
    .select("*", { count: "exact", head: true })
    .eq("delulu_id", deluluId);

  return NextResponse.json({ count: count ?? 0, userReacted: !existing });
}
