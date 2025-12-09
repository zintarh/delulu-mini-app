/**
 * Shared Self Protocol configuration
 * Centralized configuration for both frontend and backend to avoid drift
 */

export const SELF_CONFIG = {
  // Scope and App Name
  SCOPE: process.env.NEXT_PUBLIC_SELF_SCOPE || "delulu-app-v1",
  APP_NAME: process.env.NEXT_PUBLIC_SELF_APP_NAME || "Delulu",
  MINIMUM_AGE: 18,
  MOCK_PASSPORT: true,
  OFAC_CHECK: false,

  DISCLOSURES: {
    minimumAge: 18,
    nationality: true,
  },

  // Endpoint Configuration
  getEndpoint: () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/verify-self`;
    }
    return (
      process.env.NEXT_PUBLIC_SELF_ENDPOINT ||
      "https://playground.self.xyz/api/verify"
    );
  },
} as const;

export type DisclosureConfig = typeof SELF_CONFIG.DISCLOSURES;
