import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Evidence uploads accept files up to 10 MB; leave room for multipart metadata.
    serverActions: {
      bodySizeLimit: "12mb",
    },
    proxyClientMaxBodySize: "12mb",
  },
};

export default nextConfig;
