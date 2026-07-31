import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";

const PAGE_SIZE = 20;

const ADDRESS_RE = /^0x[a-f0-9]{40}$/;

async function requirePlatformAdminSession() {
  const session = await readAdminSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isPlatformAdminRole(session.staffRole)) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null };
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requirePlatformAdminSession();
  if (authError) return authError;

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
      "address, username, email, pfp_url, referral_code, created_at, auth_provider, claim_count, admin_verified",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (searchQuery.trim()) {
    const term = searchQuery.trim();
    const termLower = term.toLowerCase();
    if (ADDRESS_RE.test(termLower)) {
      query = query.eq("address", termLower);
    } else if (termLower.startsWith("0x") && termLower.length >= 6) {
      query = query.or(
        `username.ilike.%${term}%,email.ilike.%${term}%,address.ilike.%${termLower}%`,
      );
    } else {
      query = query.or(`username.ilike.%${term}%,email.ilike.%${term}%`);
    }
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

  // Backward compatibility: if claim_count/admin_verified columns don't exist yet
  // (migration not run), retry without them and default in code.
  if (error?.code === "42703") {
    console.warn("[admin/users] claim_count/admin_verified column missing, falling back:", error.message);
    let fallbackQuery = supabase
      .from("profiles")
      .select("address, username, email, pfp_url, referral_code, created_at, auth_provider", {
        count: "exact",
      })
      .order("created_at", { ascending: false });

    if (searchQuery.trim()) {
      const term = searchQuery.trim();
      const termLower = term.toLowerCase();
      if (ADDRESS_RE.test(termLower)) {
        fallbackQuery = fallbackQuery.eq("address", termLower);
      } else if (termLower.startsWith("0x") && termLower.length >= 6) {
        fallbackQuery = fallbackQuery.or(
          `username.ilike.%${term}%,email.ilike.%${term}%,address.ilike.%${termLower}%`,
        );
      } else {
        fallbackQuery = fallbackQuery.or(`username.ilike.%${term}%,email.ilike.%${term}%`);
      }
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
    data = (fallback.data ?? []).map((row) => ({
      ...row,
      claim_count: 0,
      admin_verified: false,
    }));
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
  const { error: authError } = await requirePlatformAdminSession();
  if (authError) return authError;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase();
  if (!address || !ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").delete().eq("address", address);
  if (error) {
    console.error("[admin/users] delete supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, address });
}

export async function PATCH(request: NextRequest) {
  const { error: authError } = await requirePlatformAdminSession();
  if (authError) return authError;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const address = typeof body?.address === "string" ? body.address.trim().toLowerCase() : "";

  if (!address || !ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const hasUsername = typeof body?.username === "string";
  const hasAdminVerified = typeof body?.admin_verified === "boolean";

  if (!hasUsername && !hasAdminVerified) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const update: { username?: string; admin_verified?: boolean } = {};

  if (hasUsername) {
    const username = (body.username as string).trim();
    if (!username || username.length > 32) {
      return NextResponse.json({ error: "Username must be 1-32 characters" }, { status: 400 });
    }
    update.username = username;
  }

  if (hasAdminVerified) {
    update.admin_verified = body.admin_verified as boolean;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("address", address)
    .select("address, username, admin_verified")
    .maybeSingle();

  if (error) {
    console.error("[admin/users] update supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    address: data.address,
    username: data.username,
    admin_verified: data.admin_verified,
  });
}
