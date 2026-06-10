// Speculation Rules API — Chrome 122+ / Edge 122+. Tells the browser to
// prefetch (and lightly prerender) likely-next pages so navigation feels
// instant. Safe no-op in unsupported browsers.
//
// Strategy:
// - prefetch (cheap): the small static set of pages a user is most likely to
//   hit from anywhere (homepage, standings, search, stats), PLUS — on link
//   hover — any other in-document link not covered by the prerender rule.
//   prefetch only pulls the document/RSC bytes; it does not run a server-side
//   prerender, so it's cheap enough for the dense footer/landing link clouds.
// - prerender (aggressive): triggered "moderately" on link hover — ONLY the
//   high-intent detail routes /game/{id}, /player/{id}, /team/{tricode}. This
//   warms the full RSC stream so the click is instant. Restricted to these
//   three so we don't warm full server renders for low-intent links against
//   the 11MB schedule cache + rate-limited stats endpoints.
export default function SpeculationRules() {
  const rules = {
    prefetch: [
      {
        source: "list",
        urls: ["/", "/standings", "/stats", "/search", "/calendar"],
      },
      {
        source: "document",
        where: {
          and: [
            { href_matches: "/*" },
            { not: { href_matches: "/admin*" } },
            { not: { href_matches: "/api/*" } },
            { not: { href_matches: "/game/*" } },
            { not: { href_matches: "/player/*" } },
            { not: { href_matches: "/team/*" } },
          ],
        },
        eagerness: "moderate",
      },
    ],
    prerender: [
      {
        source: "document",
        where: {
          or: [
            { href_matches: "/game/*" },
            { href_matches: "/player/*" },
            { href_matches: "/team/*" },
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
