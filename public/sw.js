// NBA Tracker — minimal Service Worker for static-asset caching.
//
// Strategy (per request type):
//  - Navigation (HTML): NETWORK-FIRST. Always try fresh. Fall back to a
//    cached "/" shell when offline. Never serve stale HTML on a working
//    network — Next.js's RSC streams and live scoreboards must stay current.
//  - Static assets (_next/static, fonts, manifest, icons): CACHE-FIRST with
//    background revalidate. These are content-hashed by Next, so a cached
//    response can never go stale relative to its URL — only deletes via
//    deploy require a new fetch.
//  - Cross-origin CDN images (cdn.nba.com headshots, logos): STALE-WHILE-
//    REVALIDATE. Show cached immediately, refresh in background.
//  - Everything else (incl. /api/*): NETWORK. No interception.
//
// Versioning: bump CACHE_VERSION on breaking-change deploys. activate
// purges every cache whose name doesn't match — defends against zombie
// shells.

const CACHE_VERSION = "v2";
const CACHE_STATIC = `nba-tracker-static-${CACHE_VERSION}`;
const CACHE_PAGES = `nba-tracker-pages-${CACHE_VERSION}`;
const CACHE_IMAGES = `nba-tracker-images-${CACHE_VERSION}`;

// Precache: minimal app shell + dedicated offline fallback page.
const PRECACHE_URLS = [
  "/",
  "/offline",
  "/manifest.json",
  "/icon-192.svg",
  "/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_PAGES).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => { /* offline at install? — skip */ })
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("nba-tracker-") && !k.endsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Helper: which cache bucket does this URL belong to?
function bucket(url) {
  if (url.pathname.startsWith("/_next/static/")) return CACHE_STATIC;
  if (url.pathname.startsWith("/_next/image")) return CACHE_IMAGES;
  if (url.origin === "https://cdn.nba.com") return CACHE_IMAGES;
  if (url.pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|avif|woff2?|ttf|eot|otf)$/i)) return CACHE_STATIC;
  return null;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle GET; POSTs etc. go straight to network.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Same-origin /api routes — never intercept. Live scoreboards must hit network.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  // Navigation: network-first with offline shell fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cache successful HTML in pages bucket for offline fallback, with a
          // bounded FIFO trim so the per-page navigation cache can't grow
          // unbounded between deploys. Cache.keys() is insertion-ordered, so
          // deleting the oldest beyond MAX_PAGES is an adequate FIFO.
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_PAGES).then(async (cache) => {
              await cache.put(req, copy);
              const keys = await cache.keys();
              const MAX_PAGES = 30;
              if (keys.length > MAX_PAGES) {
                for (const k of keys.slice(0, keys.length - MAX_PAGES)) {
                  await cache.delete(k);
                }
              }
            }).catch(() => { /* QuotaExceeded etc. — caching is best-effort */ });
          }
          return res;
        })
        .catch(async () => {
          // Prefer a cached copy of the requested page; if we never saw it,
          // fall back to the dedicated offline page, then the homepage shell.
          // Awaiting each step guarantees respondWith gets a real Response
          // (never undefined → thrown) and makes every fallback reachable.
          const cached = await caches.match(req);
          if (cached) return cached;
          const offline = await caches.match("/offline");
          if (offline) return offline;
          const home = await caches.match("/");
          if (home) return home;
          return Response.error();
        })
    );
    return;
  }

  const bucketName = bucket(url);
  if (!bucketName) return; // not our concern — let browser handle

  // Cache-first for _next/static and woff2/etc.; stale-while-revalidate for images
  if (bucketName === CACHE_STATIC) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(req, copy));
          }
          return res;
        });
      })
    );
  } else if (bucketName === CACHE_IMAGES) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_IMAGES).then((cache) => cache.put(req, copy));
          }
          return res;
        }).catch(() => cached); // if network fails, fall back to cache
        return cached || fetchPromise;
      })
    );
  }
});
