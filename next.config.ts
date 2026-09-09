import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the regression server independent of an existing local dev server.
  distDir: process.env.NODE_ENV === "development" && process.env.SKY_CORE_UI_TEST === "1"
    ? ".next-core-replay"
    : ".next",
  experimental: {
    // Allow large multipart uploads for /api/contracts/import (up to 50 MB).
    proxyClientMaxBodySize: "50mb",
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
