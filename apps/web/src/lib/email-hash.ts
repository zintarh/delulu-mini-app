/**
 * Hash email using SHA-256 for privacy
 * This creates a deterministic hash that can be stored on-chain
 * while keeping the actual email private
 * 
 * @param email - The email address to hash
 * @returns A hex-encoded SHA-256 hash of the normalized email
 * @throws Error if email is empty or invalid
 */
export async function hashEmail(email: string): Promise<string> {
  if (!email || typeof email !== "string") {
    throw new Error("Email is required and must be a string");
  }

  // Normalize email (lowercase, trim)
  const normalizedEmail = email.toLowerCase().trim();
  
  if (!normalizedEmail) {
    throw new Error("Email cannot be empty");
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error("Invalid email format");
  }
  
  // Convert to Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedEmail);
  
  // Hash using Web Crypto API
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  
  return hashHex;
}
