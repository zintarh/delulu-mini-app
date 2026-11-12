import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getAuthenticatedWallet } from "@/lib/auth/wallet-session";
import { loadChainState } from "@/lib/support/server";
import { capitalizeFirst } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Signed-in user's active, still-live, private Delulus — candidates for "make it public". */
export async function GET(request: NextRequest) {
  const wallet = getAuthenticatedWallet(request);
  if (!wallet) return NextResponse.json({ items: [] });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ items: [] });

  const { data } = await admin
    .from("forfeit_commitments")
    .select("on_chain_commitment_id, title")
    .ilike("creator_wallet", wallet)
    .eq("status", "active")
    .or("is_private.is.null,is_private.eq.true")
    .not("on_chain_commitment_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);
  const rows = data ?? [];
  const chain = await loadChainState(rows.map((r) => Number(r.on_chain_commitment_id)));
  const items = rows
    .filter((r) => {
      const c = chain.get(Number(r.on_chain_commitment_id));
      return c ? c.active && !c.cancelled : true;
    })
    .map((r) => ({ id: Number(r.on_chain_commitment_id), title: capitalizeFirst(r.title ?? "") }));
  return NextResponse.json({ items });
}
