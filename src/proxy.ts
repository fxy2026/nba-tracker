import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
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
