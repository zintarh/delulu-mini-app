import type { Metadata } from "next";
import {
  Big_Shoulders_Display,
  Fredoka,
  IBM_Plex_Mono,
  Schibsted_Grotesk,
} from "next/font/google";
import "./globals.css";

import { ProvidersShell } from "@/components/providers/providers-shell";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppSplashScreen } from "@/components/app-splash-screen";

/* Redesign type system — see docs/redesign/README.md */
const body = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

const display = Big_Shoulders_Display({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const brand = Fredoka({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-brand",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

// Dark mode is temporarily forced off in production (see theme-provider.tsx)
// — pinned to light here too so native browser chrome (address bar tint,
// scrollbars) doesn't mismatch the always-light page content.
export const viewport = {
  themeColor: "#f7f7f4",
  colorScheme: "light",
} as const;

export const metadata: Metadata = {
  title: "Delulu — Build habits you can't skip",
  description:
    "Pick a habit, put your word or a little money on it, and prove it each day with a photo. Free to start.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Delulu — Build habits you can't skip",
  },
  openGraph: {
    title: "Delulu — Build habits you can't skip",
    description:
      "Pick a habit, put your word or a little money on it, and prove it each day with a photo. Free to start.",
    url: appUrl,
    siteName: "delulu",
  },
  icons: {
    icon: [
      { url: "/favicon_io/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon_io/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: ["/favicon_io/favicon.ico"],
    apple: ["/favicon_io/apple-touch-icon.png"],
  },
  other: {
    "talentapp:project_verification":
      "388013914dddfaf9eef917711abcf5a4e51ad8b8bb32543a6ea374464cf32bd8ed80df08cbac444af7058282ea33c0415a72bda68b0da574009e714f082e2781",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${body.variable} ${display.variable} ${mono.variable} ${brand.variable} antialiased`}
      >
        <ThemeProvider>
          <AppSplashScreen />
          <ProvidersShell>{children}</ProvidersShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
