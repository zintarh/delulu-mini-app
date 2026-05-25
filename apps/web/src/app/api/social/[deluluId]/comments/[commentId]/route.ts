import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { deluluId: string; commentId: string } },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const deluluId = parseInt(params.deluluId, 10);
  const commentId = params.commentId;
  if (isNaN(deluluId) || !commentId) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const body = await req.json();
  const requesterId = typeof body.requesterId === "string" ? body.requesterId.toLowerCase() : null;
  const deluluCreator = typeof body.deluluCreator === "string" ? body.deluluCreator.toLowerCase() : null;

  if (!requesterId) return NextResponse.json({ error: "requesterId required" }, { status: 400 });

  // Fetch the comment to verify existence and get the author
  const { data: comment, error: fetchError } = await supabase
    .from("delulu_comments")
    .select("id, author_address, delulu_id")
    .eq("id", commentId)
    .eq("delulu_id", deluluId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  const isAuthor = (comment.author_address as string).toLowerCase() === requesterId;
  const isOwner = deluluCreator !== null && deluluCreator === requesterId;

  if (!isAuthor && !isOwner) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("delulu_comments")
    .delete()
    .eq("id", commentId);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
