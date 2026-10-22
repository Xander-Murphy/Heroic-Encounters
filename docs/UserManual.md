# User Manual — Heroic Encounters

## Starting the game

- **Hosted:** open the link someone gave you. Nothing to install.
- **On your computer:** install Node.js 22.5+, then run `npm start` in the project folder and open <http://localhost:8080>.

Your progress and everything you create or import is saved in your browser. After the first visit the game also works offline. Use **Settings → Backup** to move it to another browser.

## Playing

1. **Play** → choose three heroes (click a card; click again to remove) and a dungeon.
2. Each round, every hero gets one action. Click a hero (or it's selected for you), pick an ability, then click a target if asked. Enemy cards show what they **intend** to do.
3. Press **Execute Round** (or Enter). Faster characters act first — the turn-order bar shows the order.
4. Clear each wave; survivors recover some health. Beat the boss to clear the dungeon.

**Keys:** `1`–`5` choose abilities, `Enter` executes the round, `Esc` cancels targeting. Hover a card or ability for full details.

**Combat basics:** damage = power × (1 + attack/100), reduced by the target's resistance to that school (%) and then its defense. Abilities with cooldowns recharge over rounds; the Basic Attack is always available. Watch for taunts (enemies must hit that character), stuns (lose your turn), immunities and boss phases.

## Daily challenge

Home shows today's challenge: a fixed dungeon, team and twist — the same for every player. Win it for bonus renown and keep your streak going day after day.

## Progress

Every run earns **renown**, even a loss. Levels unlock new heroes. Achievements, hero mastery and the enemy codex are on the **Profile** page.

## Creating content (Workshop)

- **New hero / enemy:** set stats, pick a portrait and color, and add abilities (start from a template, then tweak). The preview card and power rating update as you type.
- **Bosses:** set an enemy's rank to Boss to add phases — effects it gains when its health drops below a threshold.
- **New dungeon:** add waves, choose which enemies can appear in each wave and how many, then pick the boss.
- **Remix:** start from a built-in or imported item without changing the original.

## Sharing

- **Share** on any of your items gives a share string and a link. Friends paste either into **Community → Import**.
- **Publish to community** (when connected to a server) gives a short code like `K7F2-QX9P` and lists it for everyone to browse.
- Imports always show a preview first, are checked for errors, and never overwrite your own creations.
