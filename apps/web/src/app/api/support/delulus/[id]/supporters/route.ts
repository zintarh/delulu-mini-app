import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { weiToWhole } from "@/lib/support/rules";
import { loadPublicProfiles } from "@/lib/support/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export type SupportersDto = {
  supporters: {
    key: string;
    username: string | null;
    pfpUrl: string | null;
    totalG: number;
    count: number;
    lastAt: string;
  }[];
  uniqueSupporters: number;
  page: number;
  hasMore: boolean;
};

/**
 * Everyone who supported a public Delulu, one row per person (summed), newest
 * first. Only confirmed support counts. No wallet addresses in the response —
 * the row key is an opaque index.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const onChainId = Number(id);
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  if (!Number.isInteger(onChainId) || onChainId < 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { data: c } = await admin
    .from("forfeit_commitments")
    .select("id")
    .eq("on_chain_commitment_id", onChainId)
    .eq("is_private", false)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await admin
    .from("delulu_supports")
    .select("supporter_wallet, amount_wei::text, confirmed_at")
    .eq("commitment_id", c.id)
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const grouped = new Map<string, { wei: bigint; count: number; lastAt: string }>();
  for (const r of (data ?? []) as { supporter_wallet: string; amount_wei: string; confirmed_at: string }[]) {
    const k = r.supporter_wallet.toLowerCase();
    const g = grouped.get(k);
    if (g) {
      g.wei += BigInt(r.amount_wei);
      g.count += 1;
    } else grouped.set(k, { wei: BigInt(r.amount_wei), count: 1, lastAt: r.confirmed_at });
  }
  const all = [...grouped.entries()];
  const slice = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const profiles = await loadPublicProfiles(admin, slice.map(([w]) => w));

  return NextResponse.json({
    supporters: slice.map(([w, g], i) => ({
      key: `${page}-${i}`,
      username: profiles.get(w)?.username ?? null,
      pfpUrl: profiles.get(w)?.pfpUrl ?? null,
      totalG: weiToWhole(g.wei),
      count: g.count,
      lastAt: g.lastAt,
    })),
    uniqueSupporters: all.length,
    page,
    hasMore: page * PAGE_SIZE < all.length,
  } satisfies SupportersDto);
}
