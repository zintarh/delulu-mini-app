import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminAuthClient } from "@/lib/supabase/middleware-admin";

export async function POST(request: NextRequest) {
  const authClient = createSupabaseAdminAuthClient(request);
  if (!authClient) {
    return NextResponse.json({ ok: true });
  }

  await authClient.supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  return authClient.applyCookiesTo(response);
}
