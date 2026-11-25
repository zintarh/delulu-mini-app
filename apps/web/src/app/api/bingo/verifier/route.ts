import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET — new Bingo cards are not given a server verifier. The player signs each
 * day themselves, so the proof counts as their own transaction. The keeper
 * still forfeits a missed deadline; it no longer marks a successful day.
 */
export async function GET() {
  return NextResponse.json({ address: null }, { headers: { "Cache-Control": "public, max-age=600" } });
}
