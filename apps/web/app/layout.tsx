import type { Metadata } from "next";
import { Inter, Playfair_Display, Gloria_Hallelujah, Schoolbell, Comic_Neue } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });
const playfair = Playfair_Display({ 
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-serif"
});
const gloria = Gloria_Hallelujah({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-gloria"
});
const schoolbell = Schoolbell({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-schoolbell"
});
const comic = Comic_Neue({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-comic"
});

const appUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

// Embed metadata for Farcaster sharing
const frame = {
  version: "1",
  imageUrl: `${appUrl}/opengraph-image.png`,
  button: {
    title: "Launch delulu-contract",
    action: {
      type: "launch_frame",
      name: "delulu-contract",
      url: appUrl,
      splashImageUrl: `${appUrl}/icon.png`,
      splashBackgroundColor: "#ffffff",
    },
  },
};

export const metadata: Metadata = {
  title: "delulu-contract",
  description: "A new Celo blockchain project",
  openGraph: {
    title: "delulu-contract",
    description: "A new Celo blockchain project",
    images: [`${appUrl}/opengraph-image.png`],
  },
  other: {
    "fc:frame": JSON.stringify(frame),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${playfair.variable} ${gloria.variable} ${schoolbell.variable} ${comic.variable}`}>
        <div className="relative flex min-h-screen flex-col">
          <Providers>
            <main className="flex-1">{children}</main>
          </Providers>
        </div>
      </body>
    </html>
  );
}
