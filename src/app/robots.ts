import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep public Next.js JS, CSS and images crawlable so search engines
        // can render the pages advertised in the sitemap.
        disallow: [
          "/api/",
          "/admin$",
          "/admin/",
          // Date-parameterized homepage variants — index "/" canonically only
          "/?date=",
        ],
      },
    ],
    sitemap: "https://nba.xpy.me/sitemap.xml",
    host: "https://nba.xpy.me",
  };
}
