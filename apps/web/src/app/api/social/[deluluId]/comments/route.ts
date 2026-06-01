import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { createNotification } from "@/lib/notifications";

export async function GET(
  _req: NextRequest,
  { params }: { params: { deluluId: string } },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const deluluId = parseInt(params.deluluId, 10);
  if (isNaN(deluluId)) return NextResponse.json({ error: "Invalid deluluId" }, { status: 400 });

  const { data, error } = await supabase
    .from("delulu_comments")
    .select("id, delulu_id, author_address, display_name, text, created_at")
    .eq("delulu_id", deluluId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const comments = (data ?? []).map((row) => ({
    id: row.id as string,
    deluluId: row.delulu_id as number,
    authorAddress: row.author_address as string,
    displayName: row.display_name as string,
    text: row.text as string,
    createdAt: row.created_at as string,
  }));

  return NextResponse.json({ comments }, {
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
  const authorAddress = typeof body.authorAddress === "string" ? body.authorAddress.toLowerCase() : null;
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : null;
  const text = typeof body.text === "string" ? body.text.trim() : null;
  const creatorAddress = typeof body.creatorAddress === "string" ? body.creatorAddress.toLowerCase() : null;

  if (!authorAddress || !displayName || !text) {
    return NextResponse.json({ error: "authorAddress, displayName, and text are required" }, { status: 400 });
  }
  if (text.length > 1000) {
    return NextResponse.json({ error: "Comment too long (max 1000 chars)" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("delulu_comments")
    .insert({ delulu_id: deluluId, author_address: authorAddress, display_name: displayName, text })
    .select("id, delulu_id, author_address, display_name, text, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify creator on new comment (skip if commenter is the creator)
  if (creatorAddress && creatorAddress !== authorAddress) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pfp_url")
      .eq("address", authorAddress)
      .maybeSingle();
    const preview = text.length > 60 ? `${text.slice(0, 60)}…` : text;
    await createNotification({
      recipientAddress: creatorAddress,
      type: "comment",
      message: `**${displayName}** commented: "${preview}"`,
      actorAddress: authorAddress,
      imageUrl: profile?.pfp_url ?? null,
      actionUrl: `/delulu/${deluluId}`,
    });
  }

  return NextResponse.json({
    comment: {
      id: data.id,
      deluluId: data.delulu_id,
      authorAddress: data.author_address,
      displayName: data.display_name,
      text: data.text,
      createdAt: data.created_at,
    },
  });
}
