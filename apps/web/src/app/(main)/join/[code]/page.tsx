import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { loadPartner } from "@/lib/referral/partners";

export const dynamic = "force-dynamic";

/**
 * /join/<CODE> — a partner's referral link (e.g. /join/BIGJAY). Decided on the
 * server, so there's no in-between loading screen: a partner's code goes
 * straight to sign-in with the referral (the sign-in page keeps it for the new
 * profile; signed-in players are sent on from there). Any other code — the old
 * community invites are gone from the app — goes to Explore.
 */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const admin = getSupabaseAdmin();
  const partner = admin ? await loadPartner(admin, code).catch(() => null) : null;
  if (partner?.active) redirect(`/sign-in?ref=${encodeURIComponent(partner.code)}`);
  redirect("/explore");
}
