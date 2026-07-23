import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { logCommunityMemberDailyClaim } from "@/lib/community/join-member";
import {
  requireAuthenticatedWallet,
  walletAuthErrorResponse,
} from "@/lib/auth/wallet-session";

const MAX_CLAIM_AMOUNT_GD = 1_000_000;

function parseClaimAmount(raw: unknown): number {
  if (raw == null) return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, MAX_CLAIM_AMOUNT_GD);
}

/** GET — batch fetch total_claimed_gd for leaderboard / wallet earned. */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const raw = request.nextUrl.searchParams.get("addresses") || "";
    const addresses = Array.from(
      new Set(
        raw
          .split(",")
          .map((a) => a.trim().toLowerCase())
          .filter((a) => a.startsWith("0x") && a.length === 42),
      ),
    ).slice(0, 200);

    if (addresses.length === 0) {
      return NextResponse.json({ totals: {} });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("address, total_claimed_gd")
      .in("address", addresses);

    // Column may not exist until migration is applied — treat as all zeros.
    if (error) {
      console.warn("[profile/claim] batch get:", error.message);
      return NextResponse.json({ totals: {} });
    }

    const totals: Record<string, number> = {};
    for (const row of data ?? []) {
      const addr = String(row.address).toLowerCase();
      const amount = Number(row.total_claimed_gd);
      totals[addr] = Number.isFinite(amount) ? amount : 0;
    }

    return NextResponse.json(
      { totals },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        },
      },
    );
  } catch (error) {
    console.error("[profile/claim] batch get error:", error);
    return NextResponse.json({ error: "Failed to fetch claimed totals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;
    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "address is required" }, { status: 400 });
    }

    const amountGd = parseClaimAmount(body.amount);
    const normalizedAddress = address.toLowerCase();
    try {
      requireAuthenticatedWallet(request, normalizedAddress);
    } catch (err) {
      return walletAuthErrorResponse(err);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    let existing: {
      address: string;
      claim_count: number | null;
      total_claimed_gd?: number | string | null;
    } | null = null;
    let supportsClaimedGd = true;

    {
      const { data, error: selectError } = await supabase
        .from("profiles")
        .select("address, claim_count, total_claimed_gd")
        .ilike("address", normalizedAddress)
        .maybeSingle();
      if (selectError) {
        // Migration not applied yet — fall back to claim_count only.
        if (/total_claimed_gd/i.test(selectError.message)) {
          supportsClaimedGd = false;
          const fallback = await supabase
            .from("profiles")
            .select("address, claim_count")
            .ilike("address", normalizedAddress)
            .maybeSingle();
          if (fallback.error) throw fallback.error;
          existing = fallback.data;
        } else {
          throw selectError;
        }
      } else {
        existing = data;
      }
    }

    const nextCount = (existing?.claim_count ?? 0) + 1;
    const prevClaimed = Number(existing?.total_claimed_gd);
    const nextClaimedGd =
      (Number.isFinite(prevClaimed) ? prevClaimed : 0) + amountGd;

    const basePayload = {
      claim_count: nextCount,
      updated_at: new Date().toISOString(),
      ...(supportsClaimedGd ? { total_claimed_gd: nextClaimedGd } : {}),
    };

    if (existing) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update(basePayload)
        .eq("address", normalizedAddress);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from("profiles").insert({
        address: normalizedAddress,
        email: `${normalizedAddress}@wallet.local`,
        ...basePayload,
      });
      if (insertError) throw insertError;
    }

    let communityLogOk = true;
    try {
      await logCommunityMemberDailyClaim(supabase, normalizedAddress);
    } catch (claimLogErr) {
      communityLogOk = false;
      console.error("[profile/claim] community claim log error:", claimLogErr);
    }

    return NextResponse.json({
      success: true,
      claim_count: nextCount,
      total_claimed_gd: supportsClaimedGd ? nextClaimedGd : undefined,
      amount_recorded: amountGd,
      community_log_ok: communityLogOk,
    });
  } catch (error) {
    console.error("[profile/claim] increment error:", error);
    return NextResponse.json({ error: "Failed to increment claim count" }, { status: 500 });
  }
}
