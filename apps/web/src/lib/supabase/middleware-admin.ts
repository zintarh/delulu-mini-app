import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };
import { isAdminUser } from "@/lib/admin-auth";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

/**
 * Refresh Supabase session cookies and return whether the caller is an admin.
 */
export async function validateAdminApiRequest(
  request: NextRequest,
): Promise<{ authed: boolean; response: NextResponse }> {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  let response = NextResponse.next({ request });

  if (!url || !anonKey) {
    return { authed: false, response };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authed = isAdminUser(user);
  return { authed, response };
}
