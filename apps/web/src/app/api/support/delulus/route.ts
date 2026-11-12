import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getAuthenticatedWallet } from "@/lib/auth/wallet-session";
import { isSupportCategory } from "@/lib/support/rules";
import {
  SUPPORT_COMMITMENT_SELECT,
  buildPublicDelulus,
  type PublicDeluluDto,
  type SupportCommitmentRow,
} from "@/lib/support/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;
const SORTS = ["trending", "newest", "most_supported", "ending_soon"] as const;
type Sort = (typeof SORTS)[number];

export type SupportFeedDto = {
  items: PublicDeluluDto[];
  page: number;
  hasMore: boolean;
  total: number;
};

/** Search text safe to embed in a PostgREST or() filter (no commas/parens/wildcards). */
function cleanQuery(q: string | null): string {
  return (q ?? "").replace(/[^\p{L}\p{N}\s'_-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

/**
 * Public discovery: only Delulus whose creator opted in (is_private = false),
 * still active, and live on-chain. Returns public-safe fields only — no
 * wallets, private descriptions, or proofs.
 */
export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const sp = request.nextUrl.searchParams;
  const category = sp.get("category");
  const sortParam = sp.get("sort") as Sort | null;
  const sort: Sort = sortParam && SORTS.includes(sortParam) ? sortParam : "trending";
  const page = Math.max(1, Math.min(100, Number(sp.get("page")) || 1));
  const q = cleanQuery(sp.get("q"));
  const viewer = getAuthenticatedWallet(request);

  let query = admin
    .from("forfeit_commitments")
    .select(SUPPORT_COMMITMENT_SELECT, { count: "exact" })
    .eq("is_private", false)
    .eq("status", "active")
    .not("on_chain_commitment_id", "is", null)
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`);

  if (isSupportCategory(category)) query = query.eq("category", category);

  if (q) {
    const like = `%${q}%`;
    const { data: people } = await admin.from("profiles").select("address").ilike("username", like).limit(50);
    const wallets = (people ?? []).map((p) => String(p.address).toLowerCase());
    const parts = [`title.ilike.${like}`, `public_description.ilike.${like}`];
    if (wallets.length) parts.push(`creator_wallet.in.(${wallets.join(",")})`);
    query = query.or(parts.join(","));
  }

  if (sort === "newest") query = query.order("public_since", { ascending: false, nullsFirst: false });
  else if (sort === "most_supported")
    query = query
      .order("support_total_wei", { ascending: false })
      .order("supporter_count", { ascending: false });
  else if (sort === "ending_soon") query = query.order("ends_at", { ascending: true, nullsFirst: false });
  else
    query = query
      .order("last_supported_at", { ascending: false, nullsFirst: false })
      .order("public_since", { ascending: false, nullsFirst: false });
  query = query.order("id", { ascending: true });

  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as SupportCommitmentRow[];
  const items = await buildPublicDelulus(admin, rows, viewer);

  const total = count ?? items.length;
  return NextResponse.json(
    { items, page, hasMore: from + rows.length < total, total } satisfies SupportFeedDto,
    { headers: { "Cache-Control": "private, max-age=15" } },
  );
}
