import Script from "next/script";

// Cloudflare Web Analytics — privacy-friendly, no cookies, unlimited events.
// The beacon is a single ~3KB script and reports page views + Web Vitals to
// the CF dashboard. Token is public (it's literally embedded in the HTML
// for every visitor), so a NEXT_PUBLIC_ env var is fine.
//
// To enable:
//   1. Sign up at https://www.cloudflare.com/web-analytics/ (free, no card)
//   2. Add a site, copy the token
//   3. Set NEXT_PUBLIC_CF_ANALYTICS_TOKEN in .env.local (dev) and on Vercel
//   4. Redeploy
//
// Renders nothing when the token is unset so local dev / forks stay clean.
export default function CloudflareAnalytics() {
  const token = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;
  if (!token) return null;
  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={`{"token":"${token}"}`}
    />
  );
}
