import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address = (body?.address as string | undefined)?.toLowerCase();
    const endpoint = (body?.endpoint as string | null | undefined) ?? null;

    if (!address || !address.startsWith("0x") || address.length !== 42) {
      return errorResponse("Valid address required", 400);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return errorResponse("Push is not configured. Missing Supabase credentials.", 500);
    }

    if (endpoint) {
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ disabled_at: new Date().toISOString() })
        .eq("endpoint", endpoint);
      if (error) return errorResponse(error.message, 500);
    } else {
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ disabled_at: new Date().toISOString() })
        .eq("address", address);
      if (error) return errorResponse(error.message, 500);
    }

    return jsonResponse({ ok: true });
  } catch (e: any) {
    return errorResponse(e?.message ?? "Failed to unsubscribe", 500);
  }
}

