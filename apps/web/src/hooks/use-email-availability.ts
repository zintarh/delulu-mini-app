import { useState, useCallback } from "react";
import { isValidEmail, normalizeEmail } from "@/lib/email-validation";
import { lookupEmailProvider } from "@/lib/email-provider-lookup";

export function useEmailAvailability() {
  const [isTaken, setIsTaken] = useState<boolean | undefined>(undefined);
  const [isChecking, setIsChecking] = useState(false);

  const checkEmail = useCallback(async (email: string) => {
    if (!isValidEmail(email)) {
      setIsTaken(undefined);
      return;
    }

    setIsChecking(true);
    try {
      const data = await lookupEmailProvider(normalizeEmail(email));
      setIsTaken(data.taken === true);
    } catch {
      setIsTaken(undefined);
    } finally {
      setIsChecking(false);
    }
  }, []);

  return { isTaken, isChecking, isAvailable: isTaken === false, checkEmail };
}
