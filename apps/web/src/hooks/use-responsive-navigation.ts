"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Hook to handle responsive navigation
 * On desktop: uses Next.js routing
 * On mobile: uses callback functions (for sheets)
 */
export function useResponsiveNavigation() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const navigate = (path: string, onMobile?: () => void) => {
    if (isMobile && onMobile) {
      onMobile();
    } else {
      router.push(path);
    }
  };

  return { isMobile, navigate };
}

