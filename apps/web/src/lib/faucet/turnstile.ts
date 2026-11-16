/**
 * Cloudflare Turnstile check for signup drips. Enforced only when
 * TURNSTILE_SECRET_KEY is set (with NEXT_PUBLIC_TURNSTILE_SITE_KEY on the
 * client), so the faucet keeps working before the keys exist.
 */
export function captchaEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyCaptcha(token: string | null | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8_000),
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch (err) {
    // Cloudflare unreachable: fail closed for signup drips — the face check
    // is always there as the other way in.
    console.error("[faucet] turnstile verify failed", err);
    return false;
  }
}
