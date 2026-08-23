import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // react-pdf ships an optional canvas dependency it never needs in the browser.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default nextConfig;
