import type { Metadata } from 'next';
import { Inter, Gloria_Hallelujah, Bebas_Neue } from 'next/font/google';
import './globals.css';

import Providers from "@/components/providers"

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const gloriaHallelujah = Gloria_Hallelujah({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-gloria',
  display: 'swap',
});

const bebasNeue = Bebas_Neue({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
});

const appUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

const frame = {
  version: "1",
  imageUrl: `${appUrl}/opengraph-image.png`,
  button: {
    title: "Launch Delulu",
    action: {
      type: "launch_frame",
      name: "delulu",
      url: appUrl,
      splashImageUrl: `${appUrl}/icon.png`,
      splashBackgroundColor: "#0a0a0a",
    },
  },
};

export const metadata: Metadata = {
  title: 'Delulu',
  description: 'A prediction market that turns social media trendy topics, opinions and wild(delusional) goals into high stakes',
  openGraph: {
    title: 'delulu',
    description: 'A prediction market that turns social media trendy topics, opinions and wild(delusional) goals into high stakes',
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
      <body className={`${inter.className} ${gloriaHallelujah.variable} ${bebasNeue.variable} antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
