import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSession,
  isOpsAuthConfigured,
  validateOpsCredentials,
} from "@/lib/admin-session";

export async function POST(request: NextRequest) {
  if (!isOpsAuthConfigured()) {
    return NextResponse.json(
      { error: "Ops auth is not configured on this environment." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "");
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const isValid = validateOpsCredentials(email, password);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }

  await createAdminSession(email);
  return NextResponse.json({ ok: true });
}

