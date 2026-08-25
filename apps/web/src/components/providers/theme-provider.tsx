"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      // Distinct key (not next-themes' default "theme") so anyone whose
      // browser has a stale "light" value stored from before dark mode was
      // properly wired up — silently overriding system preference forever —
      // gets a clean slate and starts following the OS again. A full pick
      // from Settings → Appearance still persists normally under this key
      // going forward; this only invalidates the old stuck value.
      storageKey="delulu-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
