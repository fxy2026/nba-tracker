# Search-engine sitemap

Public discovery endpoints:

- `https://nba.xpy.me/sitemap.xml`
- `https://nba.xpy.me/robots.txt`

## Coverage

The current bundled catalogs produce **6,671 unique canonical URLs**, serialized
by Next.js as **760,638 UTF-8 bytes**:

| Pages | Count | Source |
| --- | ---: | --- |
| Player profiles | 5,238 | Reviewed NBA CommonAllPlayers registry |
| Current NBA teams | 30 | `TEAM_META`, also used by team pages |
| Recorded games | 1,322 | Bundled schedule plus validated observed finals |
| Playoff series | 15 | Series with at least one recorded finished game |
| Public landing pages | 53 | Explicit existing page list |
| Populated iconic decades | 13 | Separate season/game datasets |

The 1,327-row schedule contains 1,230 regular-season games, 85 playoff games,
6 play-in games, 1 Cup final, and 5 preseason games. The sitemap retains the
existing preseason exclusion: `0012500001`, `0012500029`, `0012500030`,
`0012500003`, and `0012500013`. All recorded rows are final; this snapshot has
no if-needed placeholders and no separately stored observed finals. The catalog
also supports concrete scheduled/live games when they are present in local data.

The registry contains all 587 bundled player-index identities, all 2,840
historical shooting identities, and all 57 curated all-time-leader identities.
Tests fail if one of these sources gains an identity absent from the registry.
Registry membership establishes an available profile, not complete biography,
career statistics, or shooting coverage.

### Intentional exclusions

- Admin, API and offline routes; query/filter permutations and hash fragments.
- `/favorites`, whose content is personalized from browser-local preferences.
  Removing it from the sitemap does not add a new `noindex` policy.
- `/legends/:id`, which canonicals to `/player/:id`, and `/shot-archive/:id`,
  which redirects to a player profile. The `/shot-archive` directory is included.
- Per-player gamelogs, whose availability is narrower than profile identity
  coverage; do not generate one for every historical player.
- Legacy synthetic game aliases, unsupported/exhibition game identities,
  unknown/TBD teams and scheduled if-necessary placeholders.
- The 1,200 planned 2026–27 fixtures. Their source numbers are not canonical
  NBA game IDs, so no game URLs are inferred from them.

`/search` has a public browsing landing page. `/compare` and `/lab/career-arc`
explicitly canonicalize to their roots. Other listed lab roots have usable
default selections; only the roots are advertised, never query permutations.
Admin and offline pages already declare `noindex` and remain excluded.

## Caching and updates

This is a static Next.js metadata route with `dynamic = "error"`. It reads only
bundled catalogs and never calls the live schedule, ESPN/player fallback, or
optional compressed shooting catalog. A future accidental request-time
dependency fails instead of silently converting the sitemap to a dynamic route.
The obsolete shooting-catalog output trace is removed for `/sitemap.xml` only.

The existing `data:generate` prebuild step validates stored observed finals.
Newly deployed registry/schedule/observed-final data automatically changes the
sitemap. Live-only games or players do **not** enter the sitemap until their
canonical identities are persisted and deployed. They may still be discovered
through ordinary site links. No live data collection or submission was added.

A single root file is appropriate: the current 6,671 URLs / 0.73 MiB are well
below the protocol's 50,000 URLs / 50 MiB limits. Tests check both limits against
Next.js's actual serializer. Split with `generateSitemaps` and publish an index
if the catalog outgrows them; splitting now adds unnecessary moving parts.

No `lastmod` is emitted: no existing source records each page's last significant
content update. Game tipoff times, source retrieval times and sitemap generation
times are not substitutes. Add timestamps only when reliable page revision
metadata exists. The existing optional frequency/priority hints are preserved;
Google does not use them as ranking/freshness signals.

Robots advertises the root sitemap, keeps API and admin exclusions (including
the exact `/admin` route), and permits public `/_next/` scripts, CSS and images
so crawlers can render public pages. Existing homepage date-variant exclusion
is unchanged. Robots rules are not a security boundary.

## Checks

After changing a catalog or route policy:

```sh
npm run data:generate
npx vitest run src/lib/sitemap.test.ts src/lib/player-identity.test.ts src/lib/iconicData.test.ts
npx eslint src/app/sitemap.ts src/app/robots.ts src/lib/sitemap-catalog.ts src/lib/sitemap.test.ts next.config.ts
npx tsc --noEmit --incremental false
```

Run the normal aggregate build/release checks before publication. After deployment,
verify both public endpoints return 200, `sitemap.xml` has XML content type and
the intended URL coverage, `robots.txt` advertises it, and the build marks the
sitemap static without live-fetch diagnostics. Search-engine discovery/indexing
is not guaranteed by a successful sitemap response. Search Console/Bing account
submission is a separate action.

## Primary references

- [Next.js sitemap metadata convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [Next.js robots metadata convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots)
- [Next.js generateSitemaps](https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps)
- [Next.js caching without Cache Components](https://nextjs.org/docs/app/guides/caching-without-cache-components#route-segment-config)
- [Google: build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: robots.txt purpose and limitations](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Bing: sitemap freshness and accurate lastmod](https://blogs.bing.com/webmaster/2016/5/Sitemaps-%E2%80%93-4-Basics-to-Get-You-Started/)

Implementation was checked against the installed Next.js 16.3.6 docs and the
Google/Bing primary references above. No search-console submission is required
for the public `robots.txt` discovery link to be available to crawlers.
