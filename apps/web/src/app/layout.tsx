import type { Metadata } from "next";
import { Inter, Manrope, Gloria_Hallelujah } from "next/font/google";
import "./globals.css";

import { ProvidersShell } from "@/components/providers/providers-shell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

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

export const viewport = {
  themeColor: "#f9f8f4",
  colorScheme: "light",
} as const;

export const metadata: Metadata = {
  title: "Commiting to personal goals and growth onchain with Good dollar",
  description:
    "A prediction market that turns social media trendy topics, opinions and wild(delusional) goals into high stakes",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Commiting to personal goals and growth onchain with Good dollar",
  },
  openGraph: {
    title: "Commiting to personal goals and growth onchain with Good dollar",
    description:
      "A prediction market that turns social media trendy topics, opinions and wild(delusional) goals into high stakes",
    images: [`${appUrl}/opengraph-image.png`],
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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap"
        />
      </head>
      <body
        className={`${inter.className} ${manrope.variable} ${gloriaHallelujah.variable} antialiased`}
      >
        <ProvidersShell>{children}</ProvidersShell>
      </body>
    </html>
  );
}
