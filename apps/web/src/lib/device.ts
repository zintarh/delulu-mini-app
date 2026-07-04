"use client";

import { useEffect, useState } from "react";

const MOBILE_UA_REGEX = /Android|iPhone|iPod|iPad|Mobile|Windows Phone/i;

/**
 * User-agent based phone detection — NOT viewport-based (unlike the
 * `isMobile` viewport-width hooks used for responsive layout elsewhere).
 * Used to gate camera-capture features that require a real phone camera,
 * where a resized desktop window shouldn't count as "mobile".
 */
export function isMobileUserAgent(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return MOBILE_UA_REGEX.test(ua);
}

export function useIsMobileDevice(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileUserAgent());
  }, []);

  return isMobile;
}
