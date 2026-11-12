import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import {
  getAuthenticatedWallet,
  requireAuthenticatedWallet,
  walletAuthErrorResponse,
} from "@/lib/auth/wallet-session";
import {
  computeEndsAt,
  isSupportCategory,
  normalizePublicDescription,
  suggestCategory,
} from "@/lib/support/rules";
import { loadChainState } from "@/lib/support/server";

export const dynamic = "force-dynamic";

const SELECT =
  "id, on_chain_commitment_id, creator_wallet, title, status, is_private, category, public_description, public_since";

type Row = {
  id: string;
  on_chain_commitment_id: number | null;
  creator_wallet: string;
  title: string;
  status: string;
  is_private: boolean | null;
  category: string | null;
  public_description: string | null;
  public_since: string | null;
};

function lookup(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, params: { id?: unknown; tx?: unknown }) {
  const q = admin.from("forfeit_commitments").select(SELECT);
  const tx = typeof params.tx === "string" ? params.tx.trim() : "";
  if (/^0x[0-9a-fA-F]{64}$/.test(tx)) return q.eq("create_tx_hash", tx).maybeSingle<Row>();
  const id = Number(params.id);
  if (Number.isInteger(id) && id >= 0) return q.eq("on_chain_commitment_id", id).maybeSingle<Row>();
  return null;
}

function dto(row: Row) {
  return {
    onChainCommitmentId: row.on_chain_commitment_id,
    isPublic: row.is_private === false,
    category: isSupportCategory(row.category) ? row.category : null,
    suggestedCategory: suggestCategory(row.title),
    publicDescription: row.public_description,
    publicSince: row.public_since,
    canBePublic: row.status === "active",
  };
}

/** Owner-only read of a Delulu's visibility settings. ?id=<onChainId> or ?tx=<createTxHash> */
export async function GET(request: NextRequest) {
  const wallet = getAuthenticatedWallet(request);
  if (!wallet) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const sp = request.nextUrl.searchParams;
  const query = lookup(admin, { id: sp.get("id"), tx: sp.get("tx") });
  if (!query) return NextResponse.json({ error: "id or tx required" }, { status: 400 });
  const { data: row, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Same 404 for "missing" and "not yours" — don't confirm other people's goals exist.
  if (!row || row.creator_wallet.toLowerCase() !== wallet) {
    return NextResponse.json({ error: "Not found", retryable: true }, { status: 404 });
  }
  return NextResponse.json(dto(row));
}

/**
 * Owner sets visibility. Body: { id | tx, isPublic, category?, publicDescription? }.
 * - Going private always works and takes effect immediately (discovery filters on is_private).
 * - Going public needs the Delulu to be active in the DB and live on-chain.
 * - Support records are never touched.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  let wallet: string;
  try {
    wallet = requireAuthenticatedWallet(request);
  } catch (err) {
    return walletAuthErrorResponse(err);
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable", retryable: true }, { status: 503 });

  const query = lookup(admin, { id: body.id, tx: body.tx });
  if (!query) return NextResponse.json({ error: "id or tx required" }, { status: 400 });
  const { data: row, error } = await query;
  if (error) return NextResponse.json({ error: error.message, retryable: true }, { status: 500 });
  if (!row || row.creator_wallet.toLowerCase() !== wallet) {
    // The create flow can call this before the background save lands — retryable.
    return NextResponse.json({ error: "Not found", retryable: true }, { status: 404 });
  }
  if (typeof body.isPublic !== "boolean") {
    return NextResponse.json({ error: "isPublic must be true or false" }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (!body.isPublic) {
    const { data: updated, error: upErr } = await admin
      .from("forfeit_commitments")
      .update({ is_private: true, visibility_updated_at: now })
      .eq("id", row.id)
      .select(SELECT)
      .single<Row>();
    if (upErr) return NextResponse.json({ error: upErr.message, retryable: true }, { status: 500 });
    return NextResponse.json(dto(updated));
  }

  if (row.status !== "active") {
    return NextResponse.json(
      { error: "Only active Delulus can be public.", retryable: false },
      { status: 409 },
    );
  }
  const chain = row.on_chain_commitment_id != null
    ? (await loadChainState([row.on_chain_commitment_id])).get(row.on_chain_commitment_id)
    : undefined;
  if (!chain) {
    return NextResponse.json({ error: "Couldn't reach the chain — try again.", retryable: true }, { status: 503 });
  }
  if (!chain.active || chain.cancelled) {
    return NextResponse.json(
      { error: "Only active Delulus can be public.", retryable: false },
      { status: 409 },
    );
  }

  const category = isSupportCategory(body.category)
    ? body.category
    : isSupportCategory(row.category)
      ? row.category
      : suggestCategory(row.title);
  const publicDescription =
    "publicDescription" in body ? normalizePublicDescription(body.publicDescription) : row.public_description;
  const endsAt = computeEndsAt(chain);

  const { data: updated, error: upErr } = await admin
    .from("forfeit_commitments")
    .update({
      is_private: false,
      category,
      public_description: publicDescription,
      public_since: row.public_since ?? now,
      visibility_updated_at: now,
      ends_at: endsAt ? endsAt.toISOString() : null,
    })
    .eq("id", row.id)
    .select(SELECT)
    .single<Row>();
  if (upErr) return NextResponse.json({ error: upErr.message, retryable: true }, { status: 500 });
  return NextResponse.json(dto(updated));
}
