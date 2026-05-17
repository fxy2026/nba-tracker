// Speculation Rules API — Chrome 122+ / Edge 122+. Tells the browser to
// prefetch (and lightly prerender) likely-next pages so navigation feels
// instant. Safe no-op in unsupported browsers.
//
// Strategy:
// - prefetch (cheap): the small set of pages a user is most likely to hit
//   from anywhere (homepage, standings, search, stats).
// - prerender (more aggressive): triggered "moderately" on link hover —
//   any /game/{id} or /player/{id} or /team/{tricode} the user mouses over
//   for ~200ms. This warms the full RSC stream so the click is instant.
export default function SpeculationRules() {
  const rules = {
    prefetch: [
      {
        source: "list",
        urls: ["/", "/standings", "/stats", "/search", "/calendar"],
      },
    ],
    prerender: [
      {
        source: "document",
        where: {
          and: [
            { href_matches: "/*" },
            { not: { href_matches: "/admin*" } },
            { not: { href_matches: "/api/*" } },
          ],
        },
        eagerness: "moderate",
      },
    ],
  };

  return (
    <script
      type="speculationrules"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(rules) }}
    />
  );
}
