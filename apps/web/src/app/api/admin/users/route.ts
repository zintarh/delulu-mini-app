import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const searchQuery = searchParams.get("query") ?? "";
  const dateFilter = searchParams.get("date") ?? ""; // "today" | "yesterday" | "YYYY-MM-DD" | ""
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  let query = supabase
    .from("profiles")
    .select(
      "address, username, email, pfp_url, referral_code, created_at, auth_provider, claim_count",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (searchQuery.trim()) {
    const term = searchQuery.trim();
    query = query.or(`username.ilike.%${term}%,email.ilike.%${term}%`);
  }

  if (dateFilter === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    query = query.gte("created_at", start.toISOString());
  } else if (dateFilter === "yesterday") {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 1);
    query = query
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());
  } else if (dateFilter) {
    // specific date "YYYY-MM-DD"
    const start = new Date(`${dateFilter}T00:00:00.000Z`);
    const end = new Date(`${dateFilter}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    query = query
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  let { data, error, count } = await query;

  // Backward compatibility: if claim_count column doesn't exist yet, retry without it.
  if (error?.code === "42703") {
    console.warn("[admin/users] claim_count column missing, falling back:", error.message);
    let fallbackQuery = supabase
      .from("profiles")
      .select("address, username, email, pfp_url, referral_code, created_at, auth_provider", {
        count: "exact",
      })
      .order("created_at", { ascending: false });

    if (searchQuery.trim()) {
      const term = searchQuery.trim();
      fallbackQuery = fallbackQuery.or(`username.ilike.%${term}%,email.ilike.%${term}%`);
    }
    if (dateFilter === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      fallbackQuery = fallbackQuery.gte("created_at", start.toISOString());
    } else if (dateFilter === "yesterday") {
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      const start = new Date(end);
      start.setDate(start.getDate() - 1);
      fallbackQuery = fallbackQuery
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());
    } else if (dateFilter) {
      const start = new Date(`${dateFilter}T00:00:00.000Z`);
      const end = new Date(`${dateFilter}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      fallbackQuery = fallbackQuery
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());
    }
    fallbackQuery = fallbackQuery.range(from, to);
    const fallback = await fallbackQuery;
    data = (fallback.data ?? []).map((row) => ({ ...row, claim_count: 0 }));
    error = fallback.error;
    count = fallback.count;
  }

  if (error) {
    console.error("[admin/users] supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Provider breakdown for admin visibility
  const { data: providerStats } = await supabase
    .from("profiles")
    .select("auth_provider")
    .then(({ data, error }) => {
      if (error || !data) return { data: { privy: 0, web3auth: 0 } };
      const breakdown = data.reduce(
        (acc, row) => {
          const p = (row.auth_provider as string) ?? "privy";
          acc[p] = (acc[p] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
      return { data: { privy: breakdown["privy"] ?? 0, web3auth: breakdown["web3auth"] ?? 0 } };
    });

  return NextResponse.json({
    users: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    providerStats,
  });
}

export async function DELETE(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase();
  if (!address || !/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").delete().eq("address", address);
  if (error) {
    console.error("[admin/users] delete supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, address });
}
