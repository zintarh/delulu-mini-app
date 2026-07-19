import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { createNotification, type NotificationType } from "@/lib/notifications";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export type NotifyRecipientInput = {
  supabase: SupabaseAdmin;
  recipientAddress: string;
  eventKey: string;
  title: string;
  body: string;
  url: string;
  type: NotificationType;
  message: string;
  actorAddress?: string | null;
};

/**
 * Sends a single push notification (if the recipient has an active
 * subscription) and always writes the in-app notification row, so users
 * without push permission still see it. Idempotent via `push_events_sent`.
 */
export async function sendPushAndNotification(
  input: NotifyRecipientInput,
): Promise<{ sent: boolean; skipped: boolean }> {
  const { supabase, recipientAddress, eventKey } = input;
  const address = recipientAddress.toLowerCase();

  const { error: insertErr } = await supabase
    .from("push_events_sent")
    .insert({ event_key: eventKey, address });
  if (insertErr) {
    // Unique violation (or any insert failure) means this was already sent
    // (or the ledger write itself failed) — skip to avoid duplicates.
    return { sent: false, skipped: true };
  }

  try {
    const { data: sub } = await supabase
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("address", address)
      .is("disabled_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: input.title, body: input.body, url: input.url }),
        );
      } catch (err) {
        console.error("[notify-recipients] push send failed:", {
          address,
          eventKey,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await createNotification({
      recipientAddress: address,
      type: input.type,
      message: input.message,
      actionUrl: input.url,
      actorAddress: input.actorAddress ?? null,
    });

    return { sent: true, skipped: false };
  } catch (err) {
    console.error("[notify-recipients] notify failed:", {
      address,
      eventKey,
      message: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, skipped: true };
  }
}

/**
 * Fans a notification out to many recipients. Best-effort per recipient —
 * one failure never blocks the rest of the batch.
 */
export async function notifyManyRecipients(
  supabase: SupabaseAdmin,
  addresses: string[],
  input: Omit<NotifyRecipientInput, "supabase" | "recipientAddress" | "eventKey"> & {
    eventKeyFor: (_address: string) => string;
  },
): Promise<{ sent: number; skipped: number }> {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];

  const results = await Promise.allSettled(
    unique.map((address) =>
      sendPushAndNotification({
        supabase,
        recipientAddress: address,
        eventKey: input.eventKeyFor(address),
        title: input.title,
        body: input.body,
        url: input.url,
        type: input.type,
        message: input.message,
        actorAddress: input.actorAddress,
      }),
    ),
  );

  let sent = 0;
  let skipped = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.sent) sent++;
    else skipped++;
  }
  return { sent, skipped };
}
