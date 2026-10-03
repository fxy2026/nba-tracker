# 3D shot court

## Product and rendering contract

`ShotChartExplorer` accepts only the client-safe `VerifiedShotChart` type from
`src/lib/court-shots.ts`. Raw archives and source validation stay on the server.
Both teams are normalized toward one basket; the screen explicitly says so.
The rendering never clamps, mirrors, jitters, fabricates, or converts shot
locations using distance. A marker represents a recorded location on the floor,
not a measured release height or ball trajectory. No flight arcs are generated.

- Actual Three.js perspective scene: parquet floor, dimensional court slab,
  regulation markings, raised rim, net, and glass backboard.
- Default oblique view; explicit rotate, zoom, top-down and reset buttons.
- SVG overlay markers are projected through the **same Three.js camera** after
  every render. Color and shape both distinguish made/missed shots.
- Team, player, period and result filters, selected-shot details, previous/next
  selection and a keyboard-operable list of every filtered shot.
- Source, coverage and one-basket normalization visible in EN and ZH.
- Three.js is dynamically imported only inside the mounted client renderer.
  There is no runtime CDN, downloaded model, branded floor image, or texture URL.
- Draw-on-demand RAF invalidation coalesces changes; no idle animation loop,
  automatic camera motion, real-time shadows, or postprocessing. DPR is capped
  at 1.5. Geometry, materials, texture, renderer and observers are disposed.
- Vertical touch scrolling and browser pinch zoom remain native (`pan-y
  pinch-zoom`). Horizontal touch drag rotates; mouse drag may also tilt.
  Camera buttons provide a non-gesture alternative.
- WebGL creation errors and context loss show a top-down SVG with the same
  coordinates, filters, selected details and list. Retry creates a fresh canvas.
  SSR already renders that useful 2D view while the 3D chunk loads.
- Camera changes are immediate. No movement animation is required, and the
  component also honors reduced-motion CSS.

## Source geometry

Basket-relative NBA legacy coordinates are already converted to feet by the
validated server adapter. The renderer maps `(xFeet,yFeet)` to world
`(xFeet,0.12,yFeet)`; Y in Three.js is physical height. Negative source y remains
behind the rim. Regulation court dimensions use a 50 ft × 47 ft half court,
5.25 ft rim-to-baseline, 10 ft rim height, 16 ft lane, 23.75 ft three-point arc
and 22 ft corner line. The original NBA chart's 500 × 470 diagram uses a
rounded 5 ft baseline offset; this does not change any source shot coordinate.
The point cloud is evidence-backed; the locally drawn court is presentation.

## Research and reuse decision (2026-10-03)

The user requested existing examples and open-source research before building.
Primary sources checked:

1. [Three.js](https://github.com/mrdoob/three.js) and
   [OrbitControls documentation](https://threejs.org/docs/pages/OrbitControls.html).
   MIT; selected engine. This slice pins Three.js 0.185.1 and matching development
   types 0.185.0 instead of introducing the full React Three Fiber/Drei stack.
   This is an ordinary client-side Three.js scene inside the existing React19 /
   Next16 application. The engine owns camera math and geometry.
2. [React Three Basketball](https://github.com/benjaminmiles/react-three-basketball),
   [MIT license](https://github.com/benjaminmiles/react-three-basketball/blob/main/LICENSE).
   Benjamin Miles, 2022. Inspected source uses separate plane/box/torus components
   and perspective/orthographic cameras. Useful composition reference. Its
   React18/R3F8/Three0.146 and physics loop are not adopted. No source or assets
   are copied.
3. [TriCharts](https://github.com/gavinmgrant/tricharts), MIT license verified
   in the actual LICENSE file (Gavin Grant, 2025). Useful on-demand rendering,
   DPR cap and accessible camera-toolbar patterns. Its public demo initially
   rendered controls but then threw a client-side application exception in the
   research cloud browser. The whole package is not adopted. No code copied.
4. [Court Lens](https://github.com/airowe/court-lens) /
   [live demo](https://court-lens.pages.dev/). Visually inspected warm parquet,
   thick tabletop, oblique view and selected-event emphasis. No explicit license
   found; visual inspiration only, with independent geometry and styling here.
   Its Duke–UNC evaluation fixture and inferred motion are not reused.
5. [BallR](https://github.com/toddwschneider/ballr), MIT. Its clear scatter/hex/heat
   alternatives inform a possible later analytical view; the R/Shiny stack is
   not imported. [shotchart.d3.ts](https://github.com/michaelmirandi/shotchart.d3.ts)
   declares ISC in package.json but its ReactDOM18/MUI/D3 stack is not a good
   drop-in for this application. Public examples without an explicit license
   were not treated as reusable code.

Also consulted [React Three Fiber's performance guidance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
for draw-on-demand and resource reuse. These are design references, not copied
implementations. The only incorporated third-party runtime is Three.js; its
complete MIT notice is retained at `/third-party/three-LICENSE.txt` and in the
installed package.

## Verification boundary

Focused tests cover source-preserving geometry, combined filters, selection
hit-testing, real clock formatting, bilingual SSR fallback, lazy-loading and
client/server boundaries. The final integrated release owns full typecheck,
lint, test and production-build gates. Browser visual quality, actual touch
behavior, WebGL context loss and mobile frame time must be checked on an allowed
live preview. They are not proven by structural tests or source inspection.
