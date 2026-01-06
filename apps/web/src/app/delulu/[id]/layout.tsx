import { Metadata, ResolvingMetadata } from "next";
import { getDeluluById } from "@/lib/db/delulus";
import { StakeWithDelulu } from "@/lib/db/stakes";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    const delulu = await getDeluluById(id);

    if (!delulu) {
      return {
        title: "Vision Board Not Found",
        description: "This vision board could not be found on Delulu.",
      };
    }

    let finalBgImageUrl: string;
    const dbImageSource = delulu.bgImageUrl;

    if (dbImageSource?.startsWith("http")) {
      finalBgImageUrl = dbImageSource;
    } else if (dbImageSource && dbImageSource.includes("templates/")) {
      const cleanPath = dbImageSource.startsWith("/")
        ? dbImageSource
        : `/${dbImageSource}`;
      finalBgImageUrl = `${baseUrl}${cleanPath}`;
    } else {
      finalBgImageUrl = `${baseUrl}/templates/t0.png`;
    }

    const title = delulu.content || "My Vision Board";
    const fontName = "Gloria Hallelujah";

    const creatorStakeInfo = delulu.stakes?.find(
      (stake: StakeWithDelulu) =>
        stake.userId === delulu.creatorId && stake.side === true
    );
    const rawStakeAmount =
      creatorStakeInfo?.amount ?? delulu.totalBelieverStake ?? 1.0;
    const formattedStakeAmount = rawStakeAmount.toFixed(1);
    const ogApiUrl = new URL("/api/og", baseUrl);
    ogApiUrl.searchParams.set("title", title);
    ogApiUrl.searchParams.set("bgImage", finalBgImageUrl);
    ogApiUrl.searchParams.set("font", fontName);

    const finalOgImageUrlString = ogApiUrl.toString();
    const description = `Created a vision board on Delulu and staked ${formattedStakeAmount} cUSD`;

    return {
      title: title,
      description: description,
      openGraph: {
        title: title,
        description: description,
        images: [
          {
            url: finalOgImageUrlString,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: title,
        description: description,
        images: [finalOgImageUrlString],
      },
    };
  } catch (error) {
    console.error("Error generating metadata for Delulu ID:", id, error);
    return {
      title: "Delulu Vision Board",
      description: "View this vision board on Delulu.",
    };
  }
}

export default function DeluluLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
