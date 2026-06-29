/** Normalize for storage and comparison. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Common full-domain typos → correction (lowercase). */
const DOMAIN_TYPOS: Record<string, string> = {
  "gmail.cim": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.comm": "gmail.com",
  "gmail.cmo": "gmail.com",
  "gmail.coom": "gmail.com",
  "gmail.comn": "gmail.com",
  "gmail.om": "gmail.com",
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "yahoo.cim": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yaho.com": "yahoo.com",
  "hotmail.cim": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "outlook.cim": "outlook.com",
  "outlook.con": "outlook.com",
  "icloud.cim": "icloud.com",
  "icloud.con": "icloud.com",
};

/** TLD fragments that are almost always .com typos (not real TLDs). */
const TYPO_TLDS = new Set([
  "cim",
  "con",
  "comm",
  "cmo",
  "coom",
  "comn",
  "om",
  "cpm",
  "vom",
  "xom",
]);

const EMAIL_FORMAT =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function parseEmailParts(email: string): { local: string; domain: string; tld: string } | null {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  if (dot <= 0 || dot === domain.length - 1) return null;

  return {
    local,
    domain,
    tld: domain.slice(dot + 1),
  };
}

function domainTypoSuggestion(email: string): string | null {
  const parts = parseEmailParts(email);
  if (!parts) return null;

  const mapped = DOMAIN_TYPOS[parts.domain];
  if (mapped) return `${parts.local}@${mapped}`;

  if (TYPO_TLDS.has(parts.tld)) {
    const base = parts.domain.slice(0, parts.domain.length - parts.tld.length);
    return `${parts.local}@${base}com`;
  }

  return null;
}

/** True once the user has typed something that looks like a finished address. */
export function emailLooksComplete(email: string): boolean {
  const parts = parseEmailParts(email);
  if (!parts) return false;
  return parts.tld.length >= 2 && parts.domain.length >= 3;
}

/** Practical format check — aligned with `/api/profile/check-email`. */
export function isValidEmail(email: string): boolean {
  return getEmailValidationMessage(email) === null;
}

export function getEmailValidationMessage(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Enter your email address";

  const normalized = normalizeEmail(email);
  if (normalized.length > 254) return "Enter a valid email address";

  const parts = parseEmailParts(email);
  if (!parts) return "Enter a valid email address";

  const suggestion = domainTypoSuggestion(email);
  if (suggestion) {
    return `Did you mean ${suggestion}?`;
  }

  if (!EMAIL_FORMAT.test(normalized)) {
    return "Enter a valid email address";
  }

  if (parts.local.startsWith(".") || parts.local.endsWith(".") || parts.local.includes("..")) {
    return "Enter a valid email address";
  }

  return null;
}
