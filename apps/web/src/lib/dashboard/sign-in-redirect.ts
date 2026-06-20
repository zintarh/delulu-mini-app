/** Build sign-in URL preserving the dashboard path the user was trying to reach. */
export function signInRedirectPath(pathname: string): string {
  const safe =
    pathname.startsWith("/dashboard") && !pathname.startsWith("/signin")
      ? pathname
      : "/dashboard";
  return `/signin?next=${encodeURIComponent(safe)}`;
}
