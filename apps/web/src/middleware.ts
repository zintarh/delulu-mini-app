import { type NextRequest, NextResponse } from "next/server";
import { validateAdminApiRequest } from "@/lib/supabase/middleware-admin";

function addSecurityHeaders(response: NextResponse) {
  response.headers.delete("Content-Security-Policy");
  response.headers.set(
    "Content-Security-Policy",
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'unsafe-inline' data: blob:; img-src * data: blob:; frame-src *; style-src * 'unsafe-inline'; font-src * data: blob:; frame-ancestors *;",
  );
}

function isSignInPath(pathname: string) {
  return pathname === "/signin" || pathname.startsWith("/signin/");
}

function isAcceptInvitePath(pathname: string) {
  return pathname === "/dashboard/accept-invite" || pathname.startsWith("/dashboard/accept-invite/");
}

function isProtectedDashboardPage(pathname: string) {
  return (
    pathname.startsWith("/dashboard") &&
    !isSignInPath(pathname) &&
    !isAcceptInvitePath(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedDashboardApi =
    pathname.startsWith("/api/dashboard/") && !pathname.startsWith("/api/dashboard/auth/");

  if (isProtectedDashboardApi || isProtectedDashboardPage(pathname) || isSignInPath(pathname)) {
    const { authed, response: supabaseResponse } = await validateAdminApiRequest(request);

    if (isProtectedDashboardApi && !authed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isProtectedDashboardPage(pathname) && !authed) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/signin";
      loginUrl.searchParams.set("next", pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      addSecurityHeaders(redirectResponse);
      return redirectResponse;
    }

    if (isSignInPath(pathname) && authed) {
      const nextPath = request.nextUrl.searchParams.get("next");
      const destination =
        nextPath && nextPath.startsWith("/dashboard") && !isSignInPath(nextPath)
          ? nextPath
          : "/dashboard";
      const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
      addSecurityHeaders(redirectResponse);
      return redirectResponse;
    }

    let response = supabaseResponse;

    if (isProtectedDashboardPage(pathname)) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-pathname", pathname);
      const forwarded = NextResponse.next({ request: { headers: requestHeaders } });
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        forwarded.cookies.set(cookie);
      });
      response = forwarded;
    }

    addSecurityHeaders(response);
    return response;
  }

  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
