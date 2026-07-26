import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 6;

/** Tiny in-memory cache so repeat keystrokes / remounts don't re-hit the DB. */
const CACHE_TTL_MS = 30_000;
type LookupResult = {
  address: string;
  username: string | null;
  email: string | null;
  hasRealEmail: boolean;
  pfpUrl: string | null;
};

const resultCache = new Map<string, { at: number; results: LookupResult[] }>();

function isRealEmail(email: string | null | undefined): email is string {
  return !!email && !email.endsWith("@wallet.local");
}

/**
 * Search registered users by username (fuzzy, trigram-ranked) AND email (substring)
 * for the forfeit "tag a friend as verifier" / "forfeit to a friend" pickers.
 * Deliberately runs both searches every time instead of picking one based on
 * whether the query "looks like" an email or a username — a query like "austin"
 * has no "@" so it used to only search usernames, which silently hid any user who
 * has a matching email but no username set at all (username is nullable; a wallet
 * user who never picked one is otherwise unfindable). Username search calls the
 * search_forfeit_friends() Postgres function (pg_trgm `%` operator + a GIN trigram
 * index on profiles.username — see apps/web/src/lib/migrations for the SQL) so
 * substring/typo matches are an indexed lookup instead of a `%query%` table scan.
 * Email search is a substring match on the email trigram index, with no username
 * requirement, so a user without a username is still findable by email.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const excludeAddress = searchParams.get("excludeAddress")?.trim().toLowerCase() ?? null;

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const cacheKey = `${query.toLowerCase()}|${excludeAddress ?? ""}`;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ results: cached.results });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const usernameQ = query.replace(/^@/, "");

  const [usernameRes, emailRes] = await Promise.all([
    admin.rpc("search_forfeit_friends", { q: usernameQ, exclude_addr: excludeAddress }),
    admin
      .from("profiles")
      .select("address, username, email, pfp_url")
      .ilike("email", `%${query.toLowerCase()}%`)
      .limit(MAX_RESULTS),
  ]);

  if (usernameRes.error) {
    return NextResponse.json({ error: usernameRes.error.message }, { status: 500 });
  }
  if (emailRes.error) {
    return NextResponse.json({ error: emailRes.error.message }, { status: 500 });
  }

  const byAddress = new Map<string, { address: string; username: string | null; email: string | null; pfp_url: string | null }>();
  for (const row of [...(usernameRes.data ?? []), ...(emailRes.data ?? [])]) {
    if (!byAddress.has(row.address.toLowerCase())) {
      byAddress.set(row.address.toLowerCase(), row);
    }
  }

  const results: LookupResult[] = [...byAddress.values()]
    .filter((row) => row.address.toLowerCase() !== excludeAddress)
    .slice(0, MAX_RESULTS)
    .map((row) => {
      const hasRealEmail = isRealEmail(row.email);
      return {
        address: row.address,
        username: row.username,
        // Only expose real emails — never @wallet.local placeholders
        email: hasRealEmail ? row.email : null,
        hasRealEmail,
        pfpUrl: row.pfp_url ?? null,
      };
    });

  resultCache.set(cacheKey, { at: Date.now(), results });
  if (resultCache.size > 200) {
    const oldest = resultCache.keys().next().value;
    if (oldest) resultCache.delete(oldest);
  }

  return NextResponse.json({ results });
}
