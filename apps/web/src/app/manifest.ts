import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Delulu",
    short_name: "Delulu",
    description:
      "Create goals (delulus), set milestones, and get reminded to submit proof.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Default to dark since the app boots in dark mode.
    background_color: "#151515",
    theme_color: "#151515",
    icons: [
      {
        src: "/favicon_io/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicon_io/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/favicon_io/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}

