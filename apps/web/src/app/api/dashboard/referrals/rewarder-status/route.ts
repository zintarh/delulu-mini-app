import { NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { getRewarderStatus } from "@/lib/celo/reward-vault-payout";

export const dynamic = "force-dynamic";

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

/** The referral-payout wallet's live G$/CELO balance — lets admins see when it needs topping up. */
export async function GET() {
  const { error: authError } = await requirePlatformAdminSession();
  if (authError) return authError;

  try {
    const status = await getRewarderStatus();
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read rewarder status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
