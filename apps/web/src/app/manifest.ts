import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Delulu",
    short_name: "Delulu",
    description:
      "Build habits you can't skip. Put your word or a little money on it and prove it daily.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    // When the browser hands a link to the installed app (desktop "Open
    // supported links", Android links from other apps), reuse the open
    // window instead of stacking new ones.
    // (Next's Manifest type has a stale shape for launch_handler, hence the spread.)
    ...({ launch_handler: { client_mode: ["navigate-existing", "auto"] } } as object),
    background_color: "#f7f7f4",
    theme_color: "#f7f7f4",
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

