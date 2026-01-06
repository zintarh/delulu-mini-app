"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";


export function useResponsiveNavigation() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); 
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

