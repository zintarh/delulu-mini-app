import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/push/supabase";

const LIMIT = 50;

function validAddress(addr: string | null | undefined): addr is string {
  return (
    typeof addr === "string" &&
    addr.startsWith("0x") &&
    addr.length === 42
  );
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.toLowerCase();
  if (!validAddress(address)) return errorResponse("Valid address required", 400);

  const supabase = getSupabaseAdmin();
  if (!supabase) return errorResponse("Database not configured", 500);

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, message, image_url, action_url, read_at, created_at")
    .eq("recipient_address", address)
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  if (error) return errorResponse(error.message, 500);

  const notifications = data ?? [];
  const unread_count = notifications.filter((n) => !n.read_at).length;

  return jsonResponse({ notifications, unread_count });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const address = (body?.address as string | undefined)?.toLowerCase();
  if (!validAddress(address)) return errorResponse("Valid address required", 400);

  const supabase = getSupabaseAdmin();
  if (!supabase) return errorResponse("Database not configured", 500);

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_address", address)
    .is("read_at", null);

  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ ok: true });
}
