/** Normalize for storage and comparison. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Practical format check — aligned with `/api/profile/check-email`. */
export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized);
}

export function getEmailValidationMessage(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Enter your email address";
  if (!isValidEmail(email)) return "Enter a valid email address";
  return null;
}
