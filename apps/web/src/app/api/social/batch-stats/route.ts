import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export async function GET(req: NextRequest) {
  const rawIds = req.nextUrl.searchParams.get("ids") ?? "";
  const userAddress = req.nextUrl.searchParams.get("userAddress")?.toLowerCase() ?? null;

  const ids = rawIds
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

  if (ids.length === 0) return NextResponse.json({ stats: {} });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ stats: {} });

  // Three parallel queries — all use IN(ids) so it's one DB call each
  const [likesRows, commentsRows, reactedRows] = await Promise.all([
    supabase
      .from("delulu_likes")
      .select("delulu_id")
      .in("delulu_id", ids),
    supabase
      .from("delulu_comments")
      .select("delulu_id")
      .in("delulu_id", ids),
    userAddress
      ? supabase
          .from("delulu_likes")
          .select("delulu_id")
          .in("delulu_id", ids)
          .eq("user_address", userAddress)
      : Promise.resolve({ data: [] as { delulu_id: number }[] | null }),
  ]);

  // Aggregate in JS — counts per delulu_id
  const likesCounts = new Map<number, number>();
  const commentsCounts = new Map<number, number>();
  const reactedSet = new Set<number>();

  for (const row of likesRows.data ?? []) {
    const id = row.delulu_id as number;
    likesCounts.set(id, (likesCounts.get(id) ?? 0) + 1);
  }
  for (const row of commentsRows.data ?? []) {
    const id = row.delulu_id as number;
    commentsCounts.set(id, (commentsCounts.get(id) ?? 0) + 1);
  }
  for (const row of reactedRows.data ?? []) {
    reactedSet.add(row.delulu_id as number);
  }

  const stats: Record<string, { likes: number; comments: number; userReacted: boolean }> = {};
  for (const id of ids) {
    stats[id] = {
      likes: likesCounts.get(id) ?? 0,
      comments: commentsCounts.get(id) ?? 0,
      userReacted: reactedSet.has(id),
    };
  }

  return NextResponse.json({ stats }, { headers: { "Cache-Control": "no-store" } });
}
