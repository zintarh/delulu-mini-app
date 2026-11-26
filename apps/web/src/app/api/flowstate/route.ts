import { NextRequest, NextResponse } from "next/server";
import { isAddress, verifyMessage } from "viem";
import { FLOW_CHAIN, FLOW_COUNCIL, flowClaimMessage } from "@/lib/flow-state";
import { getFlowVoteEnabled } from "@/lib/app-settings";
import { flowTally } from "@/lib/flow-state-tally";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ELIGIBILITY = "https://flowstate.network/api/flow-council/eligibility";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** GET — "N Delulu players have voted" (our players backing Delulu + Delulu's council votes). */
export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin || !(await getFlowVoteEnabled(admin))) return reply({ voters: 0, votes: 0, canVote: 0 });
  try {
    const tally = await flowTally(admin);
    return NextResponse.json(tally, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" } });
  } catch (err) {
    console.error("[flowstate] tally failed", err);
    return reply({ error: "Count unavailable" }, 503);
  }
}

/**
 * POST { address, issuedAt, signature } — claim this wallet's votes on the
 * Flow State council. A fixed relay to Flow State's eligibility API (it has
 * no CORS): it forwards only the player's own council-bound proof, holds no
 * keys, and can't be pointed anywhere else. Flow State checks the GoodDollar
 * face verification and its bot adds the voter on-chain.
 * Adapted from Calebux/flowstate-vote-kit.
 */
export async function POST(req: NextRequest) {
  // Same-origin only, plus a header a cross-site form can't send.
  const origin = req.headers.get("origin");
  if (req.headers.get("x-flow-vote") !== "1" || (origin && origin !== req.nextUrl.origin)) return reply({ error: "Requests must come from this site." }, 403);

  const text = await req.text().catch(() => "");
  if (text.length > 2048) return reply({ error: "Request is too large." }, 413);
  let body: { address?: unknown; issuedAt?: unknown; signature?: unknown } | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  const { address, issuedAt, signature } = body ?? {};
  if (
    typeof address !== "string" ||
    !isAddress(address) ||
    typeof issuedAt !== "number" ||
    !Number.isSafeInteger(issuedAt) ||
    Math.abs(Date.now() - issuedAt) > 180_000 ||
    typeof signature !== "string" ||
    !/^0x[0-9a-fA-F]{130}$/.test(signature)
  ) {
    return reply({ error: "That took too long — tap Vote again." }, 400);
  }

  try {
    if (!(await verifyMessage({ address, message: flowClaimMessage(address, issuedAt), signature: signature as `0x${string}` }))) {
      return reply({ error: "The signature doesn't match this wallet." }, 401);
    }
    const response = await fetch(ELIGIBILITY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, issuedAt, signature, chainId: FLOW_CHAIN, councilId: FLOW_COUNCIL }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(25_000),
    });
    const data = (await response.json().catch(() => null)) as { success?: boolean; alreadyClaimed?: boolean; notWhitelisted?: boolean; reason?: string } | null;
    if (!data) return reply({ error: "Flow State didn't answer. Try again in a moment." }, 503);
    if (response.ok && data.success === true) return reply({ ok: true });
    if (data.alreadyClaimed) return reply({ error: "Your face-verified votes are on another wallet. Vote from that wallet on Flow State.", code: "IDENTITY_ALREADY_CLAIMED" }, 409);
    if (data.notWhitelisted) return reply({ error: "Verify your face first — it's what gives you votes.", code: "VERIFICATION_REQUIRED" }, 403);
    if (data.reason === "expired_signature") return reply({ error: "That took too long — tap Vote again." }, 400);
    return reply({ error: "Flow State is busy. Try again in a moment." }, response.status === 429 ? 429 : 503);
  } catch {
    return reply({ error: "Flow State didn't answer. Check again in a moment before retrying." }, 503);
  }
}
