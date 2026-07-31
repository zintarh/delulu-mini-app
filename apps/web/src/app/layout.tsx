import type { Metadata } from "next";
import { Manrope, Gloria_Hallelujah } from "next/font/google";
import "./globals.css";

import { ProvidersShell } from "@/components/providers/providers-shell";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppSplashScreen } from "@/components/app-splash-screen";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const gloriaHallelujah = Gloria_Hallelujah({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-gloria",
  display: "swap",
  preload: false,
});

const appUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

// Dark mode is temporarily forced off in production (see theme-provider.tsx)
// — pinned to light here too so native browser chrome (address bar tint,
// scrollbars) doesn't mismatch the always-light page content.
export const viewport = {
  themeColor: "#f9f8f4",
  colorScheme: "light",
} as const;

export const metadata: Metadata = {
  title: "delulu — Crush your goals with a community behind you",
  description:
    "Back your boldest goals with real stakes. Join campaigns, prove your progress publicly, and win when you deliver.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "delulu — Crush your goals with a community behind you",
  },
  openGraph: {
    title: "delulu — Crush your goals with a community behind you",
    description:
      "Back your boldest goals with real stakes. Join campaigns, prove your progress publicly, and win when you deliver.",
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
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap"
        />
      </head>
      <body
        className={`${manrope.variable} ${gloriaHallelujah.variable} antialiased`}
      >
        <ThemeProvider>
          <AppSplashScreen />
          <ProvidersShell>{children}</ProvidersShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
