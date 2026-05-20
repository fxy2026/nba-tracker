// Cloudflare Web Analytics — privacy-friendly, no cookies, unlimited free
// events. Token is public (embedded in the HTML for every visitor) so
// hardcoding is fine. Only loaded in production builds.
//
// Plain <script> instead of next/script: with strategy="afterInteractive"
// Next 16 emits only a <link rel="preload"> at SSR time and injects the
// real <script> client-side, which strips the data-cf-beacon attribute the
// beacon code needs to read at execution time. A bare <script defer> with
// the attribute on it survives SSR intact.
const CF_TOKEN = "2e066167242f48dea8a0aeef70ac318b";

export default function CloudflareAnalytics() {
  if (process.env.NODE_ENV !== "production") return null;
  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={`{"token":"${CF_TOKEN}"}`}
    />
  );
}
