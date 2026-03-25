import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address = (body?.address as string | undefined)?.toLowerCase();
    const endpoint = body?.subscription?.endpoint as string | undefined;
    const p256dh = body?.subscription?.keys?.p256dh as string | undefined;
    const auth = body?.subscription?.keys?.auth as string | undefined;

    if (!address || !address.startsWith("0x") || address.length !== 42) {
      return errorResponse("Valid address required", 400);
    }
    if (!endpoint || !p256dh || !auth) {
      return errorResponse("Valid push subscription required", 400);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return errorResponse("Push is not configured. Missing Supabase credentials.", 500);
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        address,
        endpoint,
        p256dh,
        auth,
        disabled_at: null,
      },
      { onConflict: "endpoint" },
    );

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ ok: true });
  } catch (e: any) {
    return errorResponse(e?.message ?? "Failed to subscribe", 500);
  }
}

