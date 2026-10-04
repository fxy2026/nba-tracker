/** Retired collector. Keep old browser bundles harmless even while legacy flags remain set. */
export const runtime = "nodejs";
export async function POST(): Promise<Response> {
  // Deliberately do not parse the body, read configuration, or import the database collector.
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" },
  });
}
