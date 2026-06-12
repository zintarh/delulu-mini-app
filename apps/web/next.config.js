/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // IPFS gateways
      { protocol: "https", hostname: "gateway.pinata.cloud", pathname: "/ipfs/**" },
      { protocol: "https", hostname: "ipfs.io", pathname: "/ipfs/**" },
      { protocol: "https", hostname: "cloudflare-ipfs.com", pathname: "/ipfs/**" },
      { protocol: "https", hostname: "w3s.link", pathname: "/ipfs/**" },
      { protocol: "https", hostname: "cf-ipfs.com", pathname: "/ipfs/**" },
      { protocol: "https", hostname: "dweb.link", pathname: "/ipfs/**" },
      { protocol: "https", hostname: "nftstorage.link", pathname: "/ipfs/**" },
      // User-uploaded images (any HTTPS origin — these pass through the app's upload endpoint)
      { protocol: "https", hostname: "**" },
    ],
  },
  async headers() {
    return [
      {
        // CORS for embedded webviews during local/dev testing
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
  async redirects() {
    return [{ source: "/market", destination: "/admin", permanent: false }];
  },
  transpilePackages: ["@repo/ui"],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "wagmi",
      "viem",
      "date-fns",
      "@apollo/client",
      "@tanstack/react-query",
      "@radix-ui/react-dialog",
      "@radix-ui/react-select",
      "@radix-ui/react-slider",
      "react-textarea-autosize",
      "@web3auth/modal",
    ],
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");

    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };

    return config;
  },
};

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

module.exports = withBundleAnalyzer(nextConfig);
