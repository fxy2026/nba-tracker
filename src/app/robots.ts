import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/_next/",
          // Date-parameterized homepage variants — index "/" canonically only
          "/?date=",
        ],
      },
    ],
    sitemap: "https://nba.xpy.me/sitemap.xml",
    host: "https://nba.xpy.me",
  };
}
