import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { localPlayerRouteStatus } from "@/lib/player-route-status";

export async function proxy(request: NextRequest) {
  const profile = localPlayerRouteStatus(request.nextUrl.pathname);
  if (profile && !profile.known) {
    // Unknown profiles must be rejected before loading.tsx streams HTTP 200.
    // New valid NBA IDs can still enter via the bounded current-index resolver.
    const current = profile.id === null ? false : (await import("@/lib/api")).getPlayerIndexSnapshot()
      .then(snapshot => snapshot.players.some(player => player.personId === profile.id));
    if (!await current) {
      const zh = request.cookies.get("locale")?.value === "zh" || (!request.cookies.has("locale") && /^zh/i.test(request.headers.get("accept-language") ?? ""));
      const title = zh ? "未找到此球员" : "Player not found";
      return new NextResponse(`<!doctype html><html lang="${zh ? "zh-CN" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · NBA Tracker</title></head><body style="font-family:system-ui,sans-serif;max-width:42rem;margin:12vh auto;padding:24px;line-height:1.6"><p>404</p><h1>${title}</h1><p>${zh ? "此 NBA ID 不在已收录球员名录中。" : "This NBA ID is not in the available player directory."}</p><a href="/search">${zh ? "搜索球员" : "Search players"}</a> · <a href="/">${zh ? "首页" : "Home"}</a></body></html>`, {
        status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      });
    }
  }
  // If the user already has a locale cookie, skip
  if (request.cookies.has("locale")) return NextResponse.next();

  // Detect preferred language from Accept-Language header
  const acceptLang = request.headers.get("accept-language") ?? "";
  const locale = acceptLang.match(/^zh/i) ? "zh" : "en";

  const response = NextResponse.next();
  response.cookies.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });
  return response;
}

export const config = {
  // Run on all pages, skip static assets and API routes
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons/).*)"],
};
