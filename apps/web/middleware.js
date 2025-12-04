import { NextResponse } from "next/server";

export function middleware(request) {
  const response = NextResponse.next();

  // 1. Delete any existing strict policies that are blocking you
  response.headers.delete("Content-Security-Policy");

  // 2. Set a permissive policy for development
  response.headers.set(
    "Content-Security-Policy",
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'unsafe-inline' data: blob:; img-src * data: blob:; frame-src *; style-src * 'unsafe-inline'; font-src * data: blob:; frame-ancestors *;"
  );

  return response;
}

export const config = {
  matcher: [
    // Apply to all routes except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
