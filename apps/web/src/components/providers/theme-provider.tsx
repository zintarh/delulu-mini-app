"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Dark mode is temporarily disabled in production — forcedTheme keeps every
// visitor on light regardless of stored preference or OS setting, while
// leaving the rest of the dark-mode infra untouched for later re-enable.
// To turn dark mode back on, just remove the forcedTheme prop below.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme="light"
    >
      {children}
    </NextThemesProvider>
  );
}
