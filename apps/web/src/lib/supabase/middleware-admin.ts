import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };
import { isAdminUser } from "@/lib/admin-auth";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

function createSupabaseMiddlewareClient(request: NextRequest, response: NextResponse) {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    return null;
  }

  let mutableResponse = response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        mutableResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          mutableResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  return { supabase, getResponse: () => mutableResponse };
}

/**
 * Refresh Supabase session cookies and return whether the caller is an admin.
 */
export async function validateAdminApiRequest(
  request: NextRequest,
  response: NextResponse = NextResponse.next({ request }),
): Promise<{ authed: boolean; response: NextResponse }> {
  const client = createSupabaseMiddlewareClient(request, response);

  if (!client) {
    return { authed: false, response };
  }

  const {
    data: { user },
  } = await client.supabase.auth.getUser();

  const authed = isAdminUser(user);
  return { authed, response: client.getResponse() };
}

/** Supabase client for admin auth route handlers (login/logout). */
export function createSupabaseAdminAuthClient(request: NextRequest) {
  let response = NextResponse.next({ request });
  const client = createSupabaseMiddlewareClient(request, response);
  if (!client) return null;

  return {
    supabase: client.supabase,
    applyCookiesTo(responseToMutate: NextResponse) {
      const refreshed = client.getResponse();
      refreshed.cookies.getAll().forEach((cookie) => {
        responseToMutate.cookies.set(cookie);
      });
      return responseToMutate;
    },
  };
}
