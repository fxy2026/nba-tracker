import Script from "next/script";

// Cloudflare Web Analytics — privacy-friendly, no cookies, unlimited free
// events. The beacon is a single ~3KB script and reports page views + Web
// Vitals to the CF dashboard. Token is public (embedded in the HTML for
// every visitor), so hardcoding is fine.
//
// Only loaded in production builds — keeps local dev out of the stats.
const CF_TOKEN = "2e066167242f48dea8a0aeef70ac318b";

export default function CloudflareAnalytics() {
  if (process.env.NODE_ENV !== "production") return null;
  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={`{"token":"${CF_TOKEN}"}`}
    />
  );
}
