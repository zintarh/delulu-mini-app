import { env } from "@/lib/env";

/**
 * Get the farcaster manifest for the frame, generate yours from Warpcast Mobile
 *  On your phone to Settings > Developer > Domains > insert website hostname > Generate domain manifest
 * @returns The farcaster manifest for the frame
 */
export async function getFarcasterManifest() {
  const frameName = "Delulu";
  const appUrl = env.NEXT_PUBLIC_URL;
  const noindex =
    appUrl.includes("localhost") ||
    appUrl.includes("ngrok") ||
    appUrl.includes("https://dev.");

  // Check if account association is properly configured
  const hasValidAccountAssociation =
    env.NEXT_PUBLIC_FARCASTER_HEADER !== "build-time-placeholder" &&
    env.NEXT_PUBLIC_FARCASTER_PAYLOAD !== "build-time-placeholder" &&
    env.NEXT_PUBLIC_FARCASTER_SIGNATURE !== "build-time-placeholder";

  // In development mode, allow placeholder values for testing
  const isDevelopment =
    env.NEXT_PUBLIC_APP_ENV === "development" || appUrl.includes("localhost");

  if (!hasValidAccountAssociation && !isDevelopment) {
    throw new Error(
      "Account association not configured. Please generate your account association at: https://farcaster.xyz/~/developers/mini-apps/manifest?domain=" +
        new URL(appUrl).hostname +
        " and set the NEXT_PUBLIC_FARCASTER_HEADER, NEXT_PUBLIC_FARCASTER_PAYLOAD, and NEXT_PUBLIC_FARCASTER_SIGNATURE environment variables."
    );
  }

  // Use development fallback values if in development mode and no real values are set
  const accountAssociation = hasValidAccountAssociation
    ? {
        header: env.NEXT_PUBLIC_FARCASTER_HEADER,
        payload: env.NEXT_PUBLIC_FARCASTER_PAYLOAD,
        signature: env.NEXT_PUBLIC_FARCASTER_SIGNATURE,
      }
    : {
        header: "",
        payload: "",
        signature: "",
      };

  return {
    accountAssociation,
    miniapp: {
      version: "1",
      name: frameName,
      iconUrl: `${appUrl}/icon.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/opengraph-image.png`,
      buttonTitle: `Launch App`,
      splashImageUrl: `${appUrl}/opengraph-image.png`,
      splashBackgroundColor: "#fcff52",
      webhookUrl: `${appUrl}/api/webhook`,
      // Metadata https://github.com/farcasterxyz/miniapps/discussions/191
      subtitle: "Bet on delusional goals", // 30 characters, no emojis or special characters, short description under app name
      description: "Prediction market for self-delusional goals", // 170 characters, no emojis or special characters, promotional message displayed on Mini App Page
      primaryCategory: "social",
      tags: ["mini-app", "celo", "polymarket", "delusion"], // up to 5 tags, filtering/search tags
      tagline: "Built on Celo", // 30 characters, marketing tagline should be punchy and descriptive
      ogTitle: `${frameName}`, // 30 characters, app name + short tag, Title case, no emojis
      ogDescription: "Prediction market for self-delusional goals", // 100 characters, summarize core benefits in 1-2 lines
      screenshotUrls: [
        // 1284 x 2778, visual previews of the app, max 3 screenshots
        `${appUrl}/opengraph-image.png`,
      ],
      heroImageUrl: `${appUrl}/opengraph-image.png`, // 1200 x 630px (1.91:1), promotional display image on top of the mini app store
      noindex,
    },
  };
}
