// next.config.ts
import type { NextConfig } from "next";

const BACKEND_ORIGIN = process.env.API_ORIGIN || "http://localhost:3000";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },

  async rewrites() {
    return [
      // API (JSON etc)
      {
        source: "/api/:path*",
        destination: `${BACKEND_ORIGIN}/:path*`,
      },

      // Uploads (imagens)
      {
        source: "/uploads/:path*",
        destination: `${BACKEND_ORIGIN}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
