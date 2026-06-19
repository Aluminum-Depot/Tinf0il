# 1MMUN3

A clean, fast proxy portal built on [Scramjet](https://github.com/MercuryWorkshop/scramjet) with libcurl transport. Browse, play, stream, and work — privately.

---

## Features

### Proxy & Privacy
- **Scramjet proxy** — full URL rewriting via service worker, libcurl transport
- **Tab cloaking** — spoof tab title, favicon, and address bar host; presets for Schoology, Canvas, and Google Classroom; or import from any URL
- **Stealth routing** — strips referrers and telemetry on every request
- **No logs** — zero telemetry, no tracking

### Games & Apps
- **Game catalog** — thousands of unblocked games via [3kh0 lite](https://github.com/3kh0/3kh0-lite), filterable by tag
- **App catalog** — curated list of web apps, one tap to launch
- **Favorites** — pin games and apps for quick access

### 1MMUN3 TV (`/tv`)
A full-featured streaming interface built on Next.js, embedded in the portal.

**Movies & TV Shows**
- Search and browse movies and TV shows (TMDB)
- Trending, popular, and top-rated content on the homepage
- Multiple streaming servers per title with instant switching
- Episode selector with per-season navigation
- Auto Play and Auto Next episode
- Light mode — dims the page when the player is active
- Watch history — continue where you left off
- Personal collection — save titles to a watchlist (requires account)
- Ratings, cast info, and genre metadata
- Comments section per title
- Recommendations based on what you're watching
- Share button — copies a direct link to clipboard

**Live Sports**
- Live and upcoming sports events, auto-refreshing every 60 seconds
- Events grouped by sport (MMA, boxing, wrestling, rugby, AFL, football, basketball, baseball, hockey, cricket, tennis, golf, motor sports, and more)
- Live vs. upcoming detection with real-time status
- Multiple stream sources per event with numbered stream switching
- Share button — copies a direct link to clipboard

**Catalog**
- Search across movies and TV shows simultaneously
- Filter by type (All / Movies / TV) and adult content toggle
- Paginated results with bookmarkable page URLs (`/tv/catalog/2`)

**General**
- Deep linking — every page has a shareable URL (`/tv/sports`, `/tv/sports/watch/:id`, `/tv/watch/:id`)
- URL bar stays in sync as you navigate within the TV section
- Direct URL access loads the correct page without going through the homepage

### Personalization
- **Themes** — midnight, daylight, acid, bubblegum
- **Custom cursor** — dot, crosshair, or off
- **Settings sync** — preferences tied to your account via Firebase
- **Panic key** — instantly switch tabs

---

## Stack

| Layer | Tech |
|---|---|
| Proxy | Scramjet |
| Transport | Wisp + libcurl |
| Server | Express 5 |
| Main UI | React 18 (CDN, no build step) |
| TV UI | Next.js 16 App Router + Tailwind CSS |
| Auth & Sync | Firebase |
| Movie/TV Data | TMDB API |
| Sports Data | ntvs.cx |
| Runtime | Node.js ≥ 20.11 |

---

## Getting Started

```bash
npm install
npm start
```

Open `http://localhost:8787`.

### TV Section (optional, auto-starts)

The TV app lives in `movieverse/` and starts automatically alongside the main server. If you want to run it manually:

```bash
cd movieverse
npm install
npm run dev   # development
npm start     # production (requires a build)
```

To refresh the game catalog from 3kh0 lite:

```bash
npm run build:games
```

---

## Deployment

The server binds to `process.env.PORT` (default `8787`). It walks up ports automatically if the preferred port is in use. Works out of the box on any Node-capable host (Railway, Render, Heroku, VPS, etc.).

---

## License

MIT
