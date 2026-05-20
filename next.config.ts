import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.nba.com",
        pathname: "/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      // HSTS — tells browsers (and feeds into Google's ranking signal for
      // HTTPS sites) that this host is HTTPS-only for the next year. No
      // `preload` directive — preloading is one-way and irreversible.
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      // Static /public assets that only change on deploy — let browsers
      // cache them aggressively. PSI was flagging 81 KiB of revalidation
      // traffic from the default max-age=0 Vercel applies. sw.js and
      // manifest.json are explicitly excluded below.
      {
        source: "/:path((?:.+\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2|woff)))",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Service worker — must always re-check so users get SW updates.
      // Keep the default Vercel header (max-age=0, must-revalidate).
    ];
  },
  experimental: {
    viewTransition: true,
    // Tree-shake lucide-react named imports into per-icon modules — 102 files
    // import from it; without this, each file pulls the whole barrel index in
    // dev (no impact on production builds, but cuts dev compile time).
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
