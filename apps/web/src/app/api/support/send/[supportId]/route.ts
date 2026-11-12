import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requireAuthenticatedWallet, walletAuthErrorResponse } from "@/lib/auth/wallet-session";
import {
  SUPPORT_SELECT,
  SupportError,
  attachSupportTx,
  intentDto,
  settleSupport,
  type SupportRow,
} from "@/lib/support/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/i;

async function owned(request: NextRequest, supportId: string) {
  const supporter = requireAuthenticatedWallet(request);
  const admin = getSupabaseAdmin();
  if (!admin) throw new SupportError("DB unavailable", 503, true);
  if (!UUID.test(supportId)) throw new SupportError("Not found", 404);
  return { supporter, admin };
}

function fail(err: unknown) {
  if (err instanceof SupportError) {
    return NextResponse.json({ error: err.message, retryable: err.retryable }, { status: err.status });
  }
  if (err && typeof err === "object" && "status" in err) return walletAuthErrorResponse(err);
  console.error("[support/send] failed", err);
  return NextResponse.json({ error: "Something went wrong", retryable: true }, { status: 500 });
}

/**
 * Step 2: the client reports the broadcast tx hash. The server waits a while
 * for the receipt and confirms only after reading the matching Transfer event.
 * Still "submitted" when this returns? Poll GET — the cron also settles it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ supportId: string }> }) {
  const { supportId } = await params;
  try {
    const { supporter, admin } = await owned(request, supportId);
    const body = await request.json().catch(() => ({}));
    await attachSupportTx(admin, { supporter, supportId, txHash: String(body.txHash ?? "") });
    const row = await settleSupport(admin, supportId, { waitMs: 30_000 });
    return NextResponse.json(intentDto(row!));
  } catch (err) {
    return fail(err);
  }
}

/** Status poll (owner only). Nudges settlement of a submitted tx on each call. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ supportId: string }> }) {
  const { supportId } = await params;
  try {
    const { supporter, admin } = await owned(request, supportId);
    const { data } = await admin.from("delulu_supports").select(SUPPORT_SELECT).eq("id", supportId).maybeSingle();
    const row = data as unknown as SupportRow | null;
    if (!row || row.supporter_wallet !== supporter) throw new SupportError("Not found", 404);
    const settled = row.status === "submitted" ? await settleSupport(admin, supportId, { waitMs: 4_000 }) : row;
    return NextResponse.json(intentDto(settled ?? row));
  } catch (err) {
    return fail(err);
  }
}
