import { NextResponse } from "next/server";
import { getKeeperStatus, keeperAddress } from "@/lib/celo/forfeit-keeper";

export const dynamic = "force-dynamic";

/** Below this the verifier can't safely carry new cards (each day costs it ~0.02 CELO). */
const MIN_KEEPER_CELO = 0.5;

/**
 * GET — the address new Bingo cards name as verifier (Delulu's server), so it
 * can mark days done once the AI approves. Null when the keeper is low on CELO:
 * new cards then fall back to the player signing each day, never to a card
 * nobody can finish.
 */
export async function GET() {
  const address = keeperAddress();
  if (!address) return NextResponse.json({ address: null });
  const status = await getKeeperStatus().catch(() => null);
  const funded = !!status && Number(status.celoBalance) >= MIN_KEEPER_CELO;
  if (!funded) console.error("[bingo/verifier] keeper low on CELO — new cards use player-signed days", status?.celoBalance);
  return NextResponse.json({ address: funded ? address : null }, { headers: { "Cache-Control": "public, max-age=600" } });
}
