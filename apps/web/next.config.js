/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ["@repo/ui"], // Keep this if you are in a monorepo
  experimental: {
    // Reduce shared "first navigation" JS by turning common
    // deep-import patterns into smaller per-icon/per-module chunks.
    // (Safe no-op for packages that don't support it.)
    optimizePackageImports: [
      "lucide-react",
      "wagmi",
      "viem",
      "@privy-io/react-auth",
      "@privy-io/wagmi",
    ],
  },
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    // Ignore React Native modules that MetaMask SDK tries to import in web builds
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    };
    
    return config;
  },
};

module.exports = nextConfig;