import { getSupabaseAdmin } from "@/lib/push/supabase";

export async function logCampaignEvent(
  campaignId: string,
  event: string,
  actorId?: string | null,
  metadata?: Record<string, unknown>,
) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin.from("campaign_status_events").insert({
    campaign_id: campaignId,
    event,
    actor_id: actorId ?? null,
    metadata: metadata ?? null,
  });
}
