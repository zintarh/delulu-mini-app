import { NextResponse } from "next/server";
import { validateAdminApiRequest } from "@/lib/supabase/middleware-admin";

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Protect admin API routes (auth endpoints handle their own auth)
  if (pathname.startsWith("/api/admin/") && !pathname.startsWith("/api/admin/auth/")) {
    const { authed, response: supabaseResponse } = await validateAdminApiRequest(request);
    if (!authed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    addSecurityHeaders(supabaseResponse);
    return supabaseResponse;
  }

  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

function addSecurityHeaders(response) {
  response.headers.delete("Content-Security-Policy");
  response.headers.set(
    "Content-Security-Policy",
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'unsafe-inline' data: blob:; img-src * data: blob:; frame-src *; style-src * 'unsafe-inline'; font-src * data: blob:; frame-ancestors *;",
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
