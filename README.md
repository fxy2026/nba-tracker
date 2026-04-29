<div align="center">

# NBA Tracker

**Real-time NBA scores, stats, and shot charts — built with Next.js 16 & React 19.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffxy2026%2Fnba-tracker&env=BALLDONTLIE_API_KEY,NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,ADMIN_PASSWORD&envDescription=API%20keys%20needed%20for%20full%20functionality.%20Only%20BALLDONTLIE_API_KEY%20is%20required%2C%20others%20are%20optional.&project-name=nba-tracker&repository-name=nba-tracker)

[Live Demo](https://nba.xpy.me) &nbsp;|&nbsp; [Tech Article](https://nba.xpy.me/article)

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white)
![Lines of Code](https://img.shields.io/badge/Lines_of_Code-8800+-green)

</div>

---

![Homepage](article-images/01-homepage-desktop.png)

## Features

| Feature | Description |
|---------|-------------|
| **Live Scoreboard** | Real-time scores with 30s auto-refresh, playoff bracket |
| **Game Detail** | Box Score, quarter scores, win probability chart, game summary |
| **Shot Chart** | Pure SVG basketball court (210 lines), 2PT/3PT/miss markers, player filter |
| **Key Moments** | Auto-detected lead changes, scoring runs (8-0+), clutch shots |
| **Play-by-Play** | Full game timeline with every action |
| **Player Profiles** | Career stats, season averages, draft info |
| **Team Pages** | Roster, record splits, recent schedule |
| **Standings** | Division view with playoff eligibility highlights |
| **Stats Leaders** | League-wide scoring, rebounding, assists leaderboards |
| **Game Replays** | Admin-managed replay links (Supabase) |
| **Calendar** | Monthly schedule with score previews |
| **Injuries** | Real-time injury reports (ESPN source) |
| **Search** | Instant player search with headshot previews |
| **PWA** | Add to Home Screen, standalone mode, safe-area support |
| **Dark Mode** | System-aware with manual toggle |

## Screenshots

<details>
<summary><b>Click to expand all screenshots</b></summary>

| | |
|:---:|:---:|
| ![Desktop](article-images/01-homepage-desktop.png) | ![Mobile](article-images/02-homepage-mobile.png) |
| Homepage — Desktop | Homepage — Mobile |
| ![Game](article-images/03-game-scoreboard.png) | ![BoxScore](article-images/03b-game-boxscore.png) |
| Game Detail — Scoreboard | Game Detail — Box Score |
| ![ShotChart](article-images/03c-game-shotchart.png) | ![PlayByPlay](article-images/03d-game-playbybplay.png) |
| Shot Chart | Play-by-Play Timeline |
| ![Player](article-images/05-player-header.png) | ![Stats](article-images/06-stats.png) |
| Player Profile | Stats Leaders |
| ![Standings](article-images/04-standings.png) | ![Team](article-images/11-team.png) |
| Division Standings | Team Page |
| ![Calendar](article-images/07-calendar.png) | ![Injuries](article-images/08-injuries.png) |
| Calendar | Injury Report |
| ![Search](article-images/09-search.png) | ![History](article-images/12-history.png) |
| Player Search | History |
| ![GameMobile](article-images/10-game-mobile.png) | ![Scroll](article-images/01b-homepage-scroll.png) |
| Game Detail — Mobile | Playoff Bracket |

</details>

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Homepage — Server Component + ISR 30s
│   ├── game/[id]/page.tsx  # Game Detail — Suspense streaming
│   ├── player/[id]/        # Player profile
│   ├── team/[tricode]/     # Team page
│   ├── standings/          # Division standings
│   ├── stats/              # League stat leaders
│   ├── calendar/           # Monthly schedule
│   ├── injuries/           # Injury report
│   ├── search/             # Player search
│   ├── history/            # Historical champions & MVPs
│   ├── compare/            # Player comparison
│   ├── clutch/             # Clutch stats
│   ├── admin/              # Replay link management
│   └── api/                # 13 API routes
│       ├── games/          # Schedule + scoreboard proxy
│       ├── standings/      # Standings data
│       ├── player/         # Player stats
│       ├── replay/         # CRUD replay links (Supabase)
│       └── ...
├── components/             # 39 React components
│   ├── ShotChart.tsx       # Pure SVG basketball court (210 lines)
│   ├── KeyMoments.tsx      # State machine for game highlights
│   ├── WinProbability.tsx  # Cumulative score differential chart
│   ├── PlayByPlay.tsx      # Game timeline
│   ├── GameAutoRefresh.tsx # 15s live polling (client)
│   ├── LiveScoreRefresher.tsx # 30s homepage polling (client)
│   └── ...
└── lib/
    ├── api.ts              # NBA CDN client + in-memory cache
    ├── supabase.ts         # Supabase client + replay CRUD
    └── teams.ts            # 30-team metadata
```

### Key Technical Decisions

- **Data source**: NBA CDN (`cdn.nba.com/static/json/`) — free, no API key, updated every minute during games
- **11MB schedule cache**: In-memory stale-while-revalidate with mutex lock; users never block on cache miss
- **Dual-tier polling**: 30s homepage / 15s game detail via `router.refresh()` (zero page reload)
- **Suspense streaming**: Box Score renders instantly; Key Moments and Play-by-Play stream in asynchronously
- **SVG shot chart**: Coordinate transform (NBA API x/y axes are swapped relative to SVG), Bezier curve three-point arc
- **CSS containment**: `content-visibility: auto` + `contain` + GPU layer promotion for scroll performance
- **Non-critical timeout**: Supabase calls wrapped in `Promise.race` with 2s deadline

## Getting Started

### Prerequisites

- Node.js 18+
- npm / pnpm / yarn

### 1. Clone & install

```bash
git clone https://github.com/fxy2026/nba-tracker.git
cd nba-tracker
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `BALLDONTLIE_API_KEY` | Yes | Free key from [balldontlie.io](https://www.balldontlie.io/) |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase project URL (for replay links) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase anon key |
| `ADMIN_PASSWORD` | Optional | Password for the `/admin` replay management page |

> **Note:** The core features (scores, box scores, shot charts, standings, etc.) work without any API keys — they use the free NBA CDN. The BallDontLie key is needed for player search and stats leaders.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (App Router) |
| UI | React 19 Server Components |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 4 — zero UI libraries |
| Icons | Lucide React |
| Database | Supabase (PostgreSQL) — optional |
| Data | NBA CDN + ESPN + BallDontLie |
| Deploy | Vercel |

## Stats

```
8,800+  lines of hand-written TypeScript/TSX
39      React components
16      pages
13      API routes
~4s     production build time
0       lint errors, 0 type errors
```

## Deploy

Click the button below to deploy your own instance:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffxy2026%2Fnba-tracker&env=BALLDONTLIE_API_KEY,NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,ADMIN_PASSWORD&envDescription=API%20keys%20needed%20for%20full%20functionality.%20Only%20BALLDONTLIE_API_KEY%20is%20required%2C%20others%20are%20optional.&project-name=nba-tracker&repository-name=nba-tracker)

## License

MIT
