import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow large multipart uploads for /api/contracts/import (up to 50 MB).
    proxyClientMaxBodySize: "50mb",
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
