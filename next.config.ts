import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // X-Frame-Options is set in proxy.ts (non-embed branch only).
          // Setting it here would override proxy's `delete` on /embed/* because
          // next.config.ts headers are merged AFTER middleware runs (Pitfall 1).
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
