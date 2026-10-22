import { addDays, dateKey } from './dates.js';

/** Renown needed to go from `level` to `level + 1`. */
export const renownForNextLevel = (level) => 150 + 100 * (level - 1);

export const TITLES = Object.freeze([
  { level: 1, title: 'Recruit' },
  { level: 3, title: 'Adventurer' },
  { level: 6, title: 'Veteran' },
  { level: 10, title: 'Champion' },
  { level: 15, title: 'Hero of the Realm' },
  { level: 25, title: 'Living Legend' },
]);

/** Hero mastery badges earned by clearing dungeons with that hero. */
export const MASTERY = Object.freeze([
  { wins: 1, label: 'Bronze', icon: '🥉' },
  { wins: 5, label: 'Silver', icon: '🥈' },
  { wins: 15, label: 'Gold', icon: '🥇' },
]);

export const defaultProfileData = () => ({
  installId: '',
  playerName: '',
  playerNameAt: 0, // when the name was last changed (the newest name wins when devices sync)
  renown: 0,
  achievements: {}, // id -> timestamp
  heroStats: {}, // heroId -> { runs, wins }
  dungeonStats: {}, // dungeonId -> { runs, wins, bestRounds }
  codex: {}, // enemyId -> times encountered
  stats: {
    runsStarted: 0, runsFinished: 0, runsWon: 0, reachedBoss: 0, bossesDefeated: 0, flawless: 0,
    enemiesDefeated: 0, damageDealt: 0, healingDone: 0,
    created: 0, createdDungeons: 0, shared: 0, imported: 0, communityClears: 0,
  },
  daily: { wins: {}, streak: 0, best: 0, lastWinKey: null },
  playDays: [], // date keys the game was opened on (kept to the last 60)
  seenHeroes: [], // unlocked heroes the player has been told about
});

/**
 * The player's long-term progress (Encapsulation: all changes go through
 * methods, which keep the derived numbers consistent).
 */
export class Profile {
  constructor(data = {}) {
    const defaults = defaultProfileData();
    this.data = {
      ...defaults,
      ...data,
      stats: { ...defaults.stats, ...(data.stats ?? {}) },
      daily: { ...defaults.daily, ...(data.daily ?? {}) },
    };
  }

  toJSON() {
    return this.data;
  }

  setPlayerName(name) {
    this.data.playerName = String(name ?? '').trim().slice(0, 32);
    this.data.playerNameAt = Date.now();
  }

  // --- Level and renown -----------------------------------------------------

  get renown() {
    return this.data.renown;
  }

  /** { level, intoLevel, needed } computed from total renown. */
  get levelInfo() {
    let level = 1;
    let remaining = this.data.renown;
    while (remaining >= renownForNextLevel(level)) {
      remaining -= renownForNextLevel(level);
      level += 1;
    }
    return { level, intoLevel: remaining, needed: renownForNextLevel(level) };
  }

  get level() {
    return this.levelInfo.level;
  }

  get title() {
    return [...TITLES].reverse().find((entry) => this.level >= entry.level).title;
  }

  /** Adds renown and returns how many levels were gained. */
  addRenown(amount) {
    const before = this.level;
    this.data.renown += Math.max(0, Math.round(amount));
    return this.level - before;
  }

  // --- Achievements -----------------------------------------------------------

  hasAchievement(id) {
    return Boolean(this.data.achievements[id]);
  }

  grantAchievement(id) {
    if (this.hasAchievement(id)) return false;
    this.data.achievements[id] = Date.now();
    return true;
  }

  // --- Records ------------------------------------------------------------------

  incrementStat(key, amount = 1) {
    this.data.stats[key] = (this.data.stats[key] ?? 0) + amount;
  }

  stat(key) {
    return this.data.stats[key] ?? 0;
  }

  recordEncounters(enemyIds) {
    for (const id of enemyIds) this.data.codex[id] = (this.data.codex[id] ?? 0) + 1;
  }

  codexCount() {
    return Object.keys(this.data.codex).length;
  }

  hasSeenEnemy(id) {
    return Boolean(this.data.codex[id]);
  }

  recordHeroRun(heroId, won) {
    const entry = this.data.heroStats[heroId] ?? { runs: 0, wins: 0 };
    entry.runs += 1;
    if (won) entry.wins += 1;
    this.data.heroStats[heroId] = entry;
  }

  heroWins(heroId) {
    return this.data.heroStats[heroId]?.wins ?? 0;
  }

  masteryFor(heroId) {
    const wins = this.heroWins(heroId);
    return [...MASTERY].reverse().find((tier) => wins >= tier.wins) ?? null;
  }

  recordDungeonRun(dungeonId, won, rounds) {
    const entry = this.data.dungeonStats[dungeonId] ?? { runs: 0, wins: 0, bestRounds: null };
    entry.runs += 1;
    if (won) {
      entry.wins += 1;
      entry.bestRounds = entry.bestRounds === null ? rounds : Math.min(entry.bestRounds, rounds);
    }
    this.data.dungeonStats[dungeonId] = entry;
  }

  dungeonRecord(dungeonId) {
    return this.data.dungeonStats[dungeonId] ?? { runs: 0, wins: 0, bestRounds: null };
  }

  hasCleared(dungeonId) {
    return this.dungeonRecord(dungeonId).wins > 0;
  }

  // --- Days played and daily challenge streak -----------------------------------

  /** Records that the game was opened today. Returns true on the first visit of the day. */
  markPlayDay(key = dateKey()) {
    if (this.data.playDays.includes(key)) return false;
    this.data.playDays = [...this.data.playDays, key].slice(-60);
    return true;
  }

  get daysPlayed() {
    return this.data.playDays.length;
  }

  hasWonDaily(key) {
    return Boolean(this.data.daily.wins[key]);
  }

  /** Records a daily win. Returns false if today's was already won. Updates the streak. */
  recordDailyWin(key) {
    const daily = this.data.daily;
    if (daily.wins[key]) return false;
    daily.wins[key] = true;
    daily.streak = daily.lastWinKey === addDays(key, -1) ? daily.streak + 1 : 1;
    daily.best = Math.max(daily.best, daily.streak);
    daily.lastWinKey = key;
    // Only the last 60 days matter.
    const keys = Object.keys(daily.wins).sort();
    keys.slice(0, Math.max(0, keys.length - 60)).forEach((old) => delete daily.wins[old]);
    return true;
  }

  /** Current streak, or 0 if the player missed yesterday's daily. */
  currentStreak(today = dateKey()) {
    const { lastWinKey, streak } = this.data.daily;
    if (!lastWinKey) return 0;
    return lastWinKey === today || lastWinKey === addDays(today, -1) ? streak : 0;
  }
}
