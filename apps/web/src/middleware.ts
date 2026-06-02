import { type NextRequest, NextResponse } from "next/server";
import { validateAdminApiRequest } from "@/lib/supabase/middleware-admin";

function addSecurityHeaders(response: NextResponse) {
  response.headers.delete("Content-Security-Policy");
  response.headers.set(
    "Content-Security-Policy",
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'unsafe-inline' data: blob:; img-src * data: blob:; frame-src *; style-src * 'unsafe-inline'; font-src * data: blob:; frame-ancestors *;",
  );
}

function isAdminLoginPath(pathname: string) {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

function isProtectedAdminPage(pathname: string) {
  return pathname.startsWith("/admin") && !isAdminLoginPath(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedAdminApi =
    pathname.startsWith("/api/admin/") && !pathname.startsWith("/api/admin/auth/");

  if (isProtectedAdminApi || isProtectedAdminPage(pathname) || isAdminLoginPath(pathname)) {
    const { authed, response: supabaseResponse } = await validateAdminApiRequest(request);

    if (isProtectedAdminApi && !authed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isProtectedAdminPage(pathname) && !authed) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("next", pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      addSecurityHeaders(redirectResponse);
      return redirectResponse;
    }

    if (isAdminLoginPath(pathname) && authed) {
      const nextPath = request.nextUrl.searchParams.get("next");
      const destination =
        nextPath && nextPath.startsWith("/admin") && !isAdminLoginPath(nextPath)
          ? nextPath
          : "/admin";
      const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
      addSecurityHeaders(redirectResponse);
      return redirectResponse;
    }

    addSecurityHeaders(supabaseResponse);
    return supabaseResponse;
  }

  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
