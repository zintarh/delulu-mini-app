import { NextRequest } from "next/server";
import webpush from "web-push";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/push/supabase";

function configureVapid() {
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@staydelulu.xyz";
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return null;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address = (body?.address as string | undefined)?.toLowerCase();

    if (!address || !address.startsWith("0x") || address.length !== 42) {
      return errorResponse("Valid address required", 400);
    }

    if (!configureVapid()) {
      return errorResponse("Push is not configured. Missing VAPID keys.", 500);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return errorResponse("Push is not configured. Missing Supabase credentials.", 500);
    }

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("address", address)
      .is("disabled_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return errorResponse(error.message, 500);
    if (!data) return errorResponse("No active push subscription for this address.", 404);

    await webpush.sendNotification(
      {
        endpoint: data.endpoint,
        keys: { p256dh: data.p256dh, auth: data.auth },
      },
      JSON.stringify({
        title: "Delulu reminders enabled",
        body: "This is a test notification.",
        url: "/profile",
      }),
    );

    return jsonResponse({ ok: true });
  } catch (e: any) {
    return errorResponse(e?.message ?? "Failed to send test push", 500);
  }
}

