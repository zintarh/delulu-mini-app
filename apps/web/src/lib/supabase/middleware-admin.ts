import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CookieToSet = { name: string; value: string; options: CookieOptions };
import { isAdminUser } from "@/lib/admin-auth";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

/** Returns true if the Supabase Auth user ID exists in staff_users (community_admin or platform_admin). */
export async function isStaffUser(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const url = getSupabaseUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return false;
  try {
    const admin = createClient(url, serviceKey);
    const { data } = await admin.from("staff_users").select("id").eq("id", userId).maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

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

  const authed = isAdminUser(user) || await isStaffUser(user?.id);
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
