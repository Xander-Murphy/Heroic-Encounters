# Heroic Encounters

A browser-based, turn-based team RPG. Build a party of three heroes, fight through dungeon waves to a boss, and **create your own heroes, enemies and dungeons** to share with friends — by share string, share link, or a short community code.

> Formerly *Warcraft Card Duels* (ASE 420 / ASE 330 individual project, Capstone baseline). The game was rebuilt for the web and all Warcraft-specific content was replaced with original content (see `docs/Business.md` → PESTEL → Legal).

## Play online

**<https://xander-murphy.github.io/Heroic-Encounters/>**: nothing to install. Create an account in **Settings** to save your progress online and share with everyone. (The shared server is set up by following [docs/Hosting.md](docs/Hosting.md).)

## Quick start

Requires **Node.js 22.5 or newer**. No `npm install` needed — the game and local server have zero dependencies.

```bash
git clone https://github.com/Xander-Murphy/Heroic-Encounters
cd Heroic-Encounters
npm start
```

Open <http://localhost:8080>. Once the shared server is configured in `web/js/config.js`, your local copy uses it for accounts and the community; otherwise a local database is created in `data/community.db`.

### Other ways to run it

| Goal | How |
| --- | --- |
| Play alone, no server | Serve the `web/` folder with any static server, e.g. `python3 -m http.server -d web 8000`. Everything works except community browsing/codes; share strings and links still work. |
| Play offline | After one visit, the service worker caches the game. Your progress and imported content live in the browser. |
| Host the shared server (free) | GitHub Pages + Render + MongoDB Atlas: step by step in [docs/Hosting.md](docs/Hosting.md). |
| Host for friends | Run `npm start` on any machine/VPS (`PORT`, `HOST`, `DATA_DIR`, `STORAGE=sqlite\|json`, `MONGODB_URI` env vars). |
| Static hosting + separate API | Put `web/` on GitHub Pages/itch.io, run the server elsewhere, and set its address in `web/js/config.js` or **Settings → Community server** (the API sends CORS headers). |

## Features

- **Combat** — speed-ordered rounds, enemy intents shown before you commit, 7 damage schools, resistances, buffs/debuffs, damage & heal over time, immunities, stuns, taunts, lifesteal, cleanses, boss phases.
- **9 heroes, 22 enemies, 3 dungeons** of original content; 4 enemy AI behaviors (Unpredictable, Ferocious, Protector, Cunning).
- **Workshop** — hero, enemy (incl. bosses with phases) and dungeon editors with live card preview, ability templates and a power rating (Fair / Strong / Overtuned) relative to the built-in roster.
- **Sharing** — `HE1.…` compressed share strings and links (no server needed), or publish to the community database for a code like `K7F2-QX9P`. Imports are previewed and validated before anything changes; a dungeon automatically bundles the custom enemies it needs.
- **Community** — browse, search, sort by popular/newest, import, like.
- **Accounts** (optional) — sign up in Settings to save progress and creations to the server and continue on any device. The game stays local-first: saves sync in the background and devices are merged, never overwritten. Uploads from a signed-in player carry their account name.
- **Engagement** (from `docs/Business.md`) — renown & levels, unlockable heroes, 17 achievements, seeded daily challenge with streaks, hero mastery, enemy codex, and the business plan's key metrics (DAU, 1/7-day return rate, run completion, heroes unlocked) collected anonymously. See `docs/Engagement.md`.
- Keyboard play in combat (1–5, Enter, Esc), reduced-motion support, responsive down to phone width, light/dark theme.

## Project structure

```text
web/                      The game (static files; runs in any browser)
  index.html, sw.js, manifest.webmanifest
  css/                    base, cards, combat, screens, workshop
  js/
    engine/               Pure game rules — no DOM (runs in Node for tests)
      effects/            AbilityEffect subclasses + registry
      behaviors/          Enemy AI strategies + registry
    content/              Built-in content (core/), schema validation, factory, library, power rating
    sharing/              Share-string codec, bundles, import/export service
    progression/          Profile, achievements, unlocks, daily challenge
    persistence/          Storage adapters (localStorage / memory), save backup, cloud-save merge
    account/              Sign-in and background sync of the cloud save
    analytics/            Engagement metrics (event sinks)
    api/                  Community server client
    config.js             Default community server address (empty = same origin)
    ui/                   App shell, screens/, workshop/ editors, components/
    services.js           Composition root (wires everything together)
    main.js               Entry point
server/                   Optional Node server: static files + community API
  api/                    ContentController, MetricsController, AccountController
  auth/                   Password hashing (scrypt) and bearer-token sessions
  storage/                CommunityStore interface; SQLite, MongoDB and JSON implementations
tests/                    unit/, integration/, api/ (node:test) and e2e/ (Playwright)
tools/simulate.mjs        Balance simulator (win rates per dungeon)
docs/                     Architecture, content format, engagement, business, manual, course reports
```

## Development

```bash
npm test                 # 55 unit, integration and API tests (node:test)
npm run test:e2e         # browser test of create → share → import (needs: npm i -D playwright && npx playwright install chromium)
npm run dev              # server with auto-restart
node tools/simulate.mjs  # balance check: simulated win rates per dungeon
```

Read `docs/Architecture.md` for the design (SOLID, the patterns used and why) and `docs/ContentFormat.md` for the share/content JSON format.
