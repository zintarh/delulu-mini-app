import type { NextRequest } from "next/server";

/** Shared secret for Vercel Cron (`Authorization: Bearer …`) and manual triggers. */
export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET || process.env.PUSH_CRON_SECRET;
}

export function isCronAuthorized(req: NextRequest): boolean {
  const secret = getCronSecret();
  if (!secret) return true;

  const header = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");
  const qp = req.nextUrl.searchParams.get("secret");

  return (
    header === secret ||
    qp === secret ||
    authHeader === `Bearer ${secret}`
  );
}
