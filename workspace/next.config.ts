import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // react-pdf ships an optional canvas dependency it never needs in the browser.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };

    // react-pdf's CommonJS build require()s pdf.js's ESM .mjs bundle. Webpack
    // treats .mjs as strict ESM by default, and that boundary throws
    // "Object.defineProperty called on non-object" the moment pdf.js is loaded.
    // Letting webpack detect the module type instead fixes the interop.
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: "javascript/auto",
      resolve: { fullySpecified: false },
    });

    return config;
  },
};

export default nextConfig;
