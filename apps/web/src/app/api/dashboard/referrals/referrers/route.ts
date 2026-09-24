import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { isLeaderboardBlacklisted } from "@/lib/constant";
import {
  checkReferralEligibility,
  type ReferralEligibilitySteps,
} from "@/lib/referral/eligibility";
import { getReferrerStanding, type ReferrerStanding } from "@/lib/referral/standing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Each check hits the subgraph + RPC — keep a lid on concurrent calls. */
const CONCURRENCY = 6;

export type ReferrerStatus = "active" | "locked" | "onboarding" | "blocked";

export type AdminReferrerItem = {
  address: string;
  username: string | null;
  signups: number;
  counted: number;
  gdollarsSent: number;
  status: ReferrerStatus;
  /** Onboarding steps still missing (status "onboarding"). */
  missingSteps: (keyof ReferralEligibilitySteps)[];
  /** Why they're locked (status "locked"). */
  standing: ReferrerStanding | null;
};

async function requirePlatformAdminSession() {
  const session = await readAdminSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isPlatformAdminRole(session.staffRole)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { error: null };
}

/**
 * Everyone who has referred at least one signup, and whether they can refer
 * right now: active, locked (missed a milestone, today's proof not in — see
 * lib/referral/standing.ts), still onboarding, or blacklisted.
 * GET /api/dashboard/referrals/referrers
 */
export async function GET() {
  const { error: authError } = await requirePlatformAdminSession();
  if (authError) return authError;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const [{ data: referredRows, error: referredErr }, { data: creditRows, error: creditErr }] =
    await Promise.all([
      admin.from("profiles").select("referred_by").not("referred_by", "is", null),
      admin.from("referral_credits").select("referrer_wallet, gdollars_amount, payout_status"),
    ]);
  if (referredErr || creditErr) {
    return NextResponse.json(
      { error: (referredErr ?? creditErr)!.message },
      { status: 500 },
    );
  }

  const signups = new Map<string, number>();
  for (const r of referredRows ?? []) {
    const w = String(r.referred_by).toLowerCase();
    signups.set(w, (signups.get(w) ?? 0) + 1);
  }
  const counted = new Map<string, number>();
  const sent = new Map<string, number>();
  for (const c of creditRows ?? []) {
    const w = String(c.referrer_wallet).toLowerCase();
    counted.set(w, (counted.get(w) ?? 0) + 1);
    if (c.payout_status === "sent") {
      sent.set(w, (sent.get(w) ?? 0) + (Number(c.gdollars_amount) || 0));
    }
  }

  const wallets = Array.from(new Set([...signups.keys(), ...counted.keys()]));
  const { data: profiles } = await admin
    .from("profiles")
    .select("address, username")
    .in("address", wallets);
  const usernames = new Map(
    (profiles ?? []).map((p) => [String(p.address).toLowerCase(), p.username as string | null]),
  );

  const items: AdminReferrerItem[] = [];
  const queue = [...wallets];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const address = queue.shift()!;
        const base = {
          address,
          username: usernames.get(address) ?? null,
          signups: signups.get(address) ?? 0,
          counted: counted.get(address) ?? 0,
          gdollarsSent: sent.get(address) ?? 0,
        };

        if (isLeaderboardBlacklisted(address)) {
          items.push({ ...base, status: "blocked", missingSteps: [], standing: null });
          continue;
        }

        const [eligibility, standing] = await Promise.all([
          checkReferralEligibility(admin, address),
          getReferrerStanding(admin, address),
        ]);
        const missingSteps = (
          Object.entries(eligibility.steps) as [keyof ReferralEligibilitySteps, boolean][]
        )
          .filter(([, done]) => !done)
          .map(([step]) => step);

        const status: ReferrerStatus = !eligibility.eligible
          ? "onboarding"
          : standing.locked
            ? "locked"
            : "active";
        items.push({
          ...base,
          status,
          missingSteps,
          standing: standing.locked ? standing : null,
        });
      }
    }),
  );

  items.sort((a, b) => b.signups - a.signups || b.counted - a.counted);

  return NextResponse.json({
    referrers: items,
    checkedAt: new Date().toISOString(),
  });
}
