import type { NextConfig } from "next";

const backendInternalUrl =
  process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendInternalUrl}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${backendInternalUrl}/health`,
      },
    ];
  },
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
      {
        protocol: "https",
        hostname: "lain.bgm.tv",
      },
      {
        protocol: "http",
        hostname: "lain.bgm.tv",
      },
      {
        protocol: "https",
        hostname: "bgm.tv",
      },
      {
        protocol: "http",
        hostname: "bgm.tv",
      },
    ],
  },
};

export default nextConfig;
