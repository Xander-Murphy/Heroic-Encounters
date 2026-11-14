# User Engagement: Business Plan → Features

How the engagement findings in `Business.md` (Mom Test, Value Proposition, Business Model Canvas) map to what the game does.

| Business.md says | Feature | Where |
| --- | --- | --- |
| "Progression needs significant attention… clear sense of advancement" | Renown on every run (even losses), levels with titles, "Next goals" panel on Home | `progression/Profile.js`, `ProgressionService.js`, `ui/components/widgets.js` |
| "Unlockable heroes", "Heroes unlocked per player" (key metric) | 4 starting heroes; Elara/Thorne/Brannoc/Morwen unlock by level, Ysolde by first boss kill | `content/core/heroes.js`, `progression/UnlockPolicy.js` |
| "Rewards/achievements", "collections" | 17 achievements across combat, collection, daily and community; hero mastery (🥉🥈🥇); enemy codex | `progression/achievements.js`, Profile screen |
| "Return rate after 1 and 7 days" (key metric); players leave when content stops being meaningful | Daily challenge: same dungeon, team and modifier for everyone each day; streaks; first-visit-of-the-day renown; trial of locked heroes | `progression/DailyChallenge.js`, `engine/RunModifier.js` |
| "Encounter variety… enemies need unique behavior" | 4 AI behaviors, enemy intents, bosses with phases, random waves, daily modifiers | `engine/behaviors/`, `engine/Enemy.js` |
| "Team synergy", "abilities should have synergy and counterplay" | Taunt, stun/interrupt by speed, vulnerabilities, cleanses, turn-order preview | `engine/targeting.js`, `content/core/abilities.js` |
| "Community feedback shapes new content", word of mouth (Channels) | Workshop + share strings/links + community database with likes, downloads and "popular" sort | `ui/workshop/`, `sharing/`, `server/api/ContentController.js` |
| "Small rosters / limited customization" pain | Unlimited player-made heroes, enemies, dungeons; power rating keeps shared content honest | `content/powerBudget.js` |
| Key metrics: DAU, return rate, run completion, heroes unlocked | Anonymous, opt-out analytics → server summary (Settings → Game metrics) and personal stats (Profile → Stats) | `insights/Insights.js`, `server/api/MetricsController.js` |
| "Short and simple" combat | Three heroes, one action each per round, tooltips, keyboard shortcuts, reduced motion | `ui/screens/CombatScreen.js` |

## Privacy

Analytics send only an allow-listed event name, small numeric/boolean details and a random install id. No names, content or cross-site identifiers. Players can turn it off in Settings; the server uses its own clock for retention so client clocks can't skew numbers.

## Ideas not built yet

- Server-side accounts (cross-device saves without backup strings).
- Seasonal leaderboards for the daily challenge (fewest rounds).
- Curated "featured" community dungeons and creator profiles.
- Persisting an in-progress run across page reloads.
