import type { Metadata } from 'next';
import { 
  Inter, 
  Gloria_Hallelujah, 
  Bebas_Neue,
  Oswald,
  Playfair_Display,
  Pacifico,
  Montserrat,
  Raleway,
  Poppins,
  Roboto_Condensed,
  Lora,
  Merriweather,
  Dancing_Script,
  Caveat,
  Satisfy,
  Kalam,
  Permanent_Marker,
  Indie_Flower,
  Shadows_Into_Light,
  Amatic_SC
} from 'next/font/google';
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

// Template fonts for vision board
const oswald = Oswald({ 
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-oswald',
  display: 'swap',
});

const playfairDisplay = Playfair_Display({ 
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const pacifico = Pacifico({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pacifico',
  display: 'swap',
});

const montserrat = Montserrat({ 
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

const raleway = Raleway({ 
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-raleway',
  display: 'swap',
});

const poppins = Poppins({ 
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
});

const robotoCondensed = Roboto_Condensed({ 
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-roboto-condensed',
  display: 'swap',
});

const lora = Lora({ 
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
});

const merriweather = Merriweather({ 
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-merriweather',
  display: 'swap',
});

// Dramatic/handwriting fonts for vision board
const dancingScript = Dancing_Script({ 
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-dancing',
  display: 'swap',
});

const caveat = Caveat({ 
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-caveat',
  display: 'swap',
});

const satisfy = Satisfy({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-satisfy',
  display: 'swap',
});

const kalam = Kalam({ 
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  variable: '--font-kalam',
  display: 'swap',
});

const permanentMarker = Permanent_Marker({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-permanent-marker',
  display: 'swap',
});

const indieFlower = Indie_Flower({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-indie-flower',
  display: 'swap',
});

const shadowsIntoLight = Shadows_Into_Light({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-shadows',
  display: 'swap',
});

const amaticSC = Amatic_SC({ 
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-amatic',
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
      splashBackgroundColor: "#ffffff",
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
      <body className={`${inter.className} ${gloriaHallelujah.variable} ${bebasNeue.variable} ${oswald.variable} ${playfairDisplay.variable} ${pacifico.variable} ${montserrat.variable} ${raleway.variable} ${poppins.variable} ${robotoCondensed.variable} ${lora.variable} ${merriweather.variable} ${dancingScript.variable} ${caveat.variable} ${satisfy.variable} ${kalam.variable} ${permanentMarker.variable} ${indieFlower.variable} ${shadowsIntoLight.variable} ${amaticSC.variable} antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
