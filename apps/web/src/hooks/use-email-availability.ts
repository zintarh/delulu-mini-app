import { useState, useCallback } from "react";

export function useEmailAvailability() {
  const [isTaken, setIsTaken] = useState<boolean | undefined>(undefined);
  const [isChecking, setIsChecking] = useState(false);

  const checkEmail = useCallback(async (email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setIsTaken(undefined);
      return;
    }

    setIsChecking(true);
    try {
      const res = await fetch(
        `/api/profile/check-email?email=${encodeURIComponent(email)}`
      );
      const data = await res.json();
      setIsTaken(data.taken === true);
    } catch {
      setIsTaken(undefined);
    } finally {
      setIsChecking(false);
    }
  }, []);

  return { isTaken, isChecking, isAvailable: isTaken === false, checkEmail };
}
