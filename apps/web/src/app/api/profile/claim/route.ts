import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { logCommunityMemberDailyClaim } from "@/lib/community/join-member";
import {
  requireAuthenticatedWallet,
  walletAuthErrorResponse,
} from "@/lib/auth/wallet-session";
import {
  DEFAULT_EARNED_TOKEN,
  tokenAmountToUsdt,
} from "@/lib/earned-usdt";

const MAX_TOKEN_AMOUNT = 1_000_000;
const MAX_USDT_AMOUNT = 1_000_000;

function parsePositiveAmount(raw: unknown, max: number): number {
  if (raw == null) return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

function parseKind(raw: unknown): "ubi" | "reward" {
  return raw === "ubi" ? "ubi" : "reward";
}

/** GET — batch fetch total_earned_usdt for leaderboard / wallet. */
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
      .select("address, total_earned_usdt")
      .in("address", addresses);

    if (error) {
      // Fall back to legacy total_claimed_gd if new column not migrated yet.
      if (/total_earned_usdt/i.test(error.message)) {
        const legacy = await supabase
          .from("profiles")
          .select("address, total_claimed_gd")
          .in("address", addresses);
        if (legacy.error) {
          console.warn("[profile/claim] batch get:", legacy.error.message);
          return NextResponse.json({ totals: {} });
        }
        const totals: Record<string, number> = {};
        for (const row of legacy.data ?? []) {
          const addr = String(row.address).toLowerCase();
          const amount = Number(row.total_claimed_gd);
          totals[addr] = Number.isFinite(amount) ? amount : 0;
        }
        return NextResponse.json({ totals });
      }
      console.warn("[profile/claim] batch get:", error.message);
      return NextResponse.json({ totals: {} });
    }

    const totals: Record<string, number> = {};
    for (const row of data ?? []) {
      const addr = String(row.address).toLowerCase();
      const amount = Number(row.total_earned_usdt);
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
    return NextResponse.json({ error: "Failed to fetch earned totals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;
    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "address is required" }, { status: 400 });
    }

    const kind = parseKind(body.kind);
    const tokenAddress =
      typeof body.tokenAddress === "string" && body.tokenAddress.startsWith("0x")
        ? body.tokenAddress
        : DEFAULT_EARNED_TOKEN;

    // Prefer explicit USDT amount from client; otherwise convert token amount.
    let amountUsdt = parsePositiveAmount(body.amountUsdt, MAX_USDT_AMOUNT);
    if (amountUsdt <= 0) {
      const tokenAmount = parsePositiveAmount(body.amount, MAX_TOKEN_AMOUNT);
      amountUsdt = await tokenAmountToUsdt(tokenAmount, tokenAddress);
      amountUsdt = Math.min(amountUsdt, MAX_USDT_AMOUNT);
    }

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
      total_earned_usdt?: number | string | null;
      total_claimed_gd?: number | string | null;
    } | null = null;
    let earnedColumn: "total_earned_usdt" | "total_claimed_gd" | null =
      "total_earned_usdt";

    {
      const { data, error: selectError } = await supabase
        .from("profiles")
        .select("address, claim_count, total_earned_usdt")
        .ilike("address", normalizedAddress)
        .maybeSingle();
      if (selectError) {
        if (/total_earned_usdt/i.test(selectError.message)) {
          const fallback = await supabase
            .from("profiles")
            .select("address, claim_count, total_claimed_gd")
            .ilike("address", normalizedAddress)
            .maybeSingle();
          if (fallback.error) {
            if (/total_claimed_gd/i.test(fallback.error.message)) {
              earnedColumn = null;
              const bare = await supabase
                .from("profiles")
                .select("address, claim_count")
                .ilike("address", normalizedAddress)
                .maybeSingle();
              if (bare.error) throw bare.error;
              existing = bare.data;
            } else {
              throw fallback.error;
            }
          } else {
            earnedColumn = "total_claimed_gd";
            existing = fallback.data;
          }
        } else {
          throw selectError;
        }
      } else {
        existing = data;
      }
    }

    const nextCount =
      kind === "ubi" ? (existing?.claim_count ?? 0) + 1 : (existing?.claim_count ?? 0);

    const prevEarnedRaw =
      earnedColumn === "total_earned_usdt"
        ? existing?.total_earned_usdt
        : earnedColumn === "total_claimed_gd"
          ? existing?.total_claimed_gd
          : 0;
    const prevEarned = Number(prevEarnedRaw);
    const nextEarned =
      (Number.isFinite(prevEarned) ? prevEarned : 0) + amountUsdt;

    const basePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (kind === "ubi") {
      basePayload.claim_count = nextCount;
    }
    if (earnedColumn && amountUsdt > 0) {
      basePayload[earnedColumn] = nextEarned;
    }

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
        claim_count: kind === "ubi" ? nextCount : 0,
        ...(earnedColumn && amountUsdt > 0 ? { [earnedColumn]: nextEarned } : {}),
        updated_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;
    }

    let communityLogOk = true;
    if (kind === "ubi") {
      try {
        await logCommunityMemberDailyClaim(supabase, normalizedAddress);
      } catch (claimLogErr) {
        communityLogOk = false;
        console.error("[profile/claim] community claim log error:", claimLogErr);
      }
    }

    return NextResponse.json({
      success: true,
      claim_count: nextCount,
      total_earned_usdt: earnedColumn ? nextEarned : undefined,
      amount_usdt_recorded: amountUsdt,
      community_log_ok: communityLogOk,
    });
  } catch (error) {
    console.error("[profile/claim] increment error:", error);
    return NextResponse.json({ error: "Failed to record earned amount" }, { status: 500 });
  }
}
