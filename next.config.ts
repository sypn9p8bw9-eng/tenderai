import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Tender document uploads accept files up to 25 MB; leave room for multipart metadata.
    serverActions: {
      bodySizeLimit: "27mb",
    },
    proxyClientMaxBodySize: "27mb",
  },
};

export default nextConfig;
