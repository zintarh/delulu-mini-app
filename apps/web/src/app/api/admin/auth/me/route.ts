import { NextResponse } from "next/server";
import { isOpsAuthConfigured, readAdminSession } from "@/lib/admin-session";

export async function GET() {
  const configured = isOpsAuthConfigured();
  if (!configured) {
    return NextResponse.json({ configured: false, authenticated: false, session: null });
  }

  const session = await readAdminSession();
  return NextResponse.json({
    configured: true,
    authenticated: Boolean(session),
    session,
  });
}

