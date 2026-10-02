// Speculation rules are hints, not a guarantee of network or billing savings.
// Keep the existing user-intent document rules; do not eagerly fetch a fixed
// list on every page visit. Fetching dynamic documents can still execute
// server work, even without browser prerendering. Unsupported browsers ignore
// these rules and navigate normally when a link is activated.
export default function SpeculationRules() {
  const rules = {
    prefetch: [
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
