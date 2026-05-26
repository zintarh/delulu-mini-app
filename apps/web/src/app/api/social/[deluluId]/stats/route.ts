import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: { deluluId: string } },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ likes: 0, comments: 0, userReacted: false });

  const deluluId = parseInt(params.deluluId, 10);
  if (isNaN(deluluId)) return NextResponse.json({ likes: 0, comments: 0, userReacted: false });

  const userAddress = req.nextUrl.searchParams.get("userAddress")?.toLowerCase() ?? null;

  const [likesRes, commentsRes, reactedRes] = await Promise.all([
    supabase
      .from("delulu_likes")
      .select("*", { count: "exact", head: true })
      .eq("delulu_id", deluluId),
    supabase
      .from("delulu_comments")
      .select("*", { count: "exact", head: true })
      .eq("delulu_id", deluluId),
    userAddress
      ? supabase
          .from("delulu_likes")
          .select("id")
          .eq("delulu_id", deluluId)
          .eq("user_address", userAddress)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    likes: likesRes.count ?? 0,
    comments: commentsRes.count ?? 0,
    userReacted: !!reactedRes.data,
  }, { headers: { "Cache-Control": "no-store" } });
}
