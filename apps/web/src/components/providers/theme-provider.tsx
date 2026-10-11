"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * The redesign is light-only (docs/redesign/README.md), so the theme is
 * forced to light regardless of the OS setting or any stored preference.
 * Settings → Appearance hides itself while a theme is forced.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      storageKey="delulu-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
