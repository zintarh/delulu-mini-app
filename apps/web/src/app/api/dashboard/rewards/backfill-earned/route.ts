import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { creditProfileEarnedFromToken } from "@/lib/profile-earned";

type GrantRow = {
  id: string;
  recipient_address: string;
  token_address: string;
  amount: number | string;
  earned_credited: boolean | null;
};

/**
 * Credit profiles.total_earned_usdt for admin RewardVault grants that were
 * recorded before earned tracking existed (earned_credited = false).
 *
 * POST body (optional): { address?: "0x…" } to limit to one recipient.
 */
export async function POST(request: NextRequest) {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPlatformAdminRole(session.staffRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let filterAddress: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    const raw = typeof body?.address === "string" ? body.address.trim() : "";
    if (raw) {
      if (!isAddress(raw)) {
        return NextResponse.json({ error: "Invalid address" }, { status: 400 });
      }
      filterAddress = getAddress(raw).toLowerCase();
    }
  } catch {
    // empty body is fine
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let query = admin
    .from("admin_reward_grants")
    .select("id, recipient_address, token_address, amount, earned_credited")
    .eq("earned_credited", false)
    .order("created_at", { ascending: true })
    .limit(500);

  if (filterAddress) {
    query = query.eq("recipient_address", filterAddress);
  }

  const { data, error } = await query;
  if (error) {
    // Column may not exist yet — ask ops to run the migration.
    if (/earned_credited/i.test(error.message)) {
      return NextResponse.json(
        {
          error:
            "Run docs/migrations/20260724_admin_reward_earned_credited.sql first",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as GrantRow[];
  let creditedCount = 0;
  let creditedUsdtTotal = 0;
  const failures: string[] = [];

  for (const row of rows) {
    const amount = Number(row.amount);
    const result = await creditProfileEarnedFromToken({
      address: row.recipient_address,
      amount,
      tokenAddress: row.token_address,
    });
    if (result.creditedUsdt <= 0) {
      failures.push(`${row.id}: could not credit (amount=${amount})`);
      continue;
    }
    const { error: markError } = await admin
      .from("admin_reward_grants")
      .update({ earned_credited: true })
      .eq("id", row.id);
    if (markError) {
      failures.push(`${row.id}: ${markError.message}`);
      continue;
    }
    creditedCount += 1;
    creditedUsdtTotal += result.creditedUsdt;
  }

  return NextResponse.json({
    scanned: rows.length,
    creditedCount,
    creditedUsdtTotal,
    failures,
    filterAddress,
  });
}
