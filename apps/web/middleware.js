import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const ADMIN_SESSION_COOKIE = "delulu_admin_session";

function getJwtSecret() {
  const secret =
    process.env.ADMIN_OPS_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "dev-admin-session-secret";
  return new TextEncoder().encode(secret);
}

async function isValidAdminSession(request) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload?.role === "ops";
  } catch {
    return false;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Protect admin API routes (auth endpoints handle their own auth)
  if (pathname.startsWith("/api/admin/") && !pathname.startsWith("/api/admin/auth/")) {
    const authed = await isValidAdminSession(request);
    if (!authed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

function addSecurityHeaders(response) {
  response.headers.delete("Content-Security-Policy");
  response.headers.set(
    "Content-Security-Policy",
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'unsafe-inline' data: blob:; img-src * data: blob:; frame-src *; style-src * 'unsafe-inline'; font-src * data: blob:; frame-ancestors *;"
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
