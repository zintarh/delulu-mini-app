import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { createNotification, type NotificationType } from "@/lib/notifications";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

let vapidConfigured = false;
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@staydelulu.xyz";
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
  return true;
}

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
    // Send to every active subscription for this address, not just the most
    // recent — a user can have push enabled on more than one device/browser.
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("address", address)
      .is("disabled_at", null);

    if (subs && subs.length > 0 && ensureVapidConfigured()) {
      await Promise.allSettled(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({ title: input.title, body: input.body, url: input.url }),
            );
          } catch (err) {
            const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
            // 404/410 means the push service revoked this endpoint (e.g. app
            // uninstalled, browser data cleared) — it will never succeed
            // again, so disable it instead of retrying forever.
            if (statusCode === 404 || statusCode === 410) {
              await supabase
                .from("push_subscriptions")
                .update({ disabled_at: new Date().toISOString() })
                .eq("endpoint", sub.endpoint);
            }
            console.error("[notify-recipients] push send failed:", {
              address,
              eventKey,
              statusCode,
              message: err instanceof Error ? err.message : String(err),
            });
          }
        }),
      );
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
