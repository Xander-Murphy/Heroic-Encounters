import { ContentSource } from '../content/ContentLibrary.js';
import { RunState } from '../engine/DungeonRun.js';
import { ACHIEVEMENTS } from './achievements.js';
import { UnlockPolicy } from './UnlockPolicy.js';

/** Renown rewards, in one place for balancing. */
export const RENOWN = Object.freeze({
  perEnemy: 8,
  perEncounter: 15,
  boss: 60,
  flawless: 40,
  dailyWin: 75,
  firstVisitOfDay: 20,
  difficultyBonus: 0.25, // +25% per difficulty step above 1
});

/**
 * Applies everything that happens in the game to the player's Profile:
 * renown and levels, achievements, hero unlocks, mastery, codex and the
 * daily streak. Saves after each change and announces what was earned on
 * the event bus (for toasts and analytics).
 */
export class ProgressionService {
  constructor({ profile, store, library, events }) {
    this.profile = profile;
    this.store = store;
    this.library = library;
    this.events = events;
    this.unlocks = new UnlockPolicy(profile);
  }

  // --- Queries ---------------------------------------------------------------

  isHeroAvailable(heroDefinition) {
    return this.library.meta(heroDefinition.id)?.source !== ContentSource.CORE || this.unlocks.isUnlocked(heroDefinition);
  }

  availableHeroes() {
    return this.library.heroes().filter((hero) => this.isHeroAvailable(hero));
  }

  achievementContext() {
    const coreHeroes = this.library.heroes({ source: ContentSource.CORE });
    return {
      coreHeroIds: coreHeroes.map((hero) => hero.id),
      coreDungeonIds: this.library.dungeons({ source: ContentSource.CORE }).map((dungeon) => dungeon.id),
      isUnlocked: (id) => this.unlocks.isUnlocked(this.library.get(id)),
    };
  }

  // --- Recording what happened ------------------------------------------------

  /** Call once when the game opens. Returns renown granted for the first visit of the day. */
  startSession() {
    const firstToday = this.profile.markPlayDay();
    const report = this.#newReport();
    if (firstToday && this.profile.daysPlayed > 1) this.#grant(report, RENOWN.firstVisitOfDay, 'Welcome back');
    this.#settle(report);
    return report;
  }

  recordRunStart(run) {
    this.profile.incrementStat('runsStarted');
    this.#save();
    this.events?.emit('run.started', { dungeonId: run.dungeon.id, daily: Boolean(run.tags.daily), heroIds: run.party.map((hero) => hero.contentId) });
  }

  recordEncounter(enemies) {
    this.profile.recordEncounters([...new Set(enemies.map((enemy) => enemy.contentId))]);
    this.#save();
  }

  /**
   * Score a finished run and return a report for the summary screen:
   * { renown, lines: [{label, amount}], levelsGained, level, achievements, heroesUnlocked, dailyWon, streak }
   */
  completeRun(run) {
    const report = this.#newReport();
    const won = run.state === RunState.WON;
    const { stats } = run;
    const profile = this.profile;
    const lostNobody = won && run.heroesLost() === 0;

    profile.incrementStat('runsFinished');
    profile.incrementStat('enemiesDefeated', stats.enemiesDefeated);
    profile.incrementStat('damageDealt', stats.damageDealt);
    profile.incrementStat('healingDone', stats.healingDone);
    if (run.reachedBoss) profile.incrementStat('reachedBoss');
    if (won) {
      profile.incrementStat('runsWon');
      profile.incrementStat('bossesDefeated');
      if (lostNobody) profile.incrementStat('flawless');
      const source = this.library.meta(run.dungeon.id)?.source;
      if (source === ContentSource.IMPORTED) profile.incrementStat('communityClears');
    }
    profile.recordDungeonRun(run.dungeon.id, won, stats.rounds);
    run.party.forEach((hero) => profile.recordHeroRun(hero.contentId, won));

    const multiplier = 1 + RENOWN.difficultyBonus * ((run.dungeon.difficulty ?? 1) - 1);
    this.#grant(report, stats.enemiesDefeated * RENOWN.perEnemy * multiplier, `${stats.enemiesDefeated} enemies defeated`);
    this.#grant(report, stats.encountersWon * RENOWN.perEncounter * multiplier, `${stats.encountersWon} encounters won`);
    if (won) this.#grant(report, RENOWN.boss * multiplier, 'Boss defeated');
    if (lostNobody) this.#grant(report, RENOWN.flawless, 'Nobody left behind');

    if (run.tags.daily && won) {
      report.dailyWon = profile.recordDailyWin(run.tags.daily);
      if (report.dailyWon) this.#grant(report, RENOWN.dailyWin, 'Daily challenge');
    }
    report.streak = profile.currentStreak();

    this.events?.emit('run.finished', {
      dungeonId: run.dungeon.id, won, reachedBoss: run.reachedBoss, rounds: stats.rounds,
      heroesLost: run.heroesLost(), daily: Boolean(run.tags.daily),
    });
    this.#settle(report);
    return report;
  }

  recordCreation(definition, { isNew }) {
    if (!isNew) return this.#settle(this.#newReport());
    this.profile.incrementStat('created');
    if (definition.kind === 'dungeon') this.profile.incrementStat('createdDungeons');
    this.events?.emit('content.created', { kind: definition.kind });
    return this.#settle(this.#newReport());
  }

  recordShare() {
    this.profile.incrementStat('shared');
    return this.#settle(this.#newReport());
  }

  recordImport(count) {
    this.profile.incrementStat('imported', count);
    return this.#settle(this.#newReport());
  }

  // --- Internals -----------------------------------------------------------------

  #newReport() {
    return {
      renown: 0, lines: [], levelsGained: 0, achievements: [], heroesUnlocked: [],
      unlockedBefore: new Set(this.#unlockedCoreHeroIds()), levelBefore: this.profile.level,
    };
  }

  #grant(report, amount, label) {
    const rounded = Math.round(amount);
    if (rounded <= 0) return;
    report.renown += rounded;
    report.lines.push({ label, amount: rounded });
    this.profile.addRenown(rounded);
  }

  /** Award achievements (which can grant renown, which can unlock more) until nothing changes. */
  #settle(report) {
    let changed = true;
    while (changed) {
      changed = false;
      const context = this.achievementContext();
      for (const achievement of ACHIEVEMENTS) {
        if (!this.profile.hasAchievement(achievement.id) && achievement.isEarned(this.profile, context)) {
          this.profile.grantAchievement(achievement.id);
          report.achievements.push(achievement);
          this.#grant(report, achievement.renown, `Achievement: ${achievement.name}`);
          this.events?.emit('achievement.unlocked', { id: achievement.id, name: achievement.name, icon: achievement.icon });
          changed = true;
        }
      }
    }

    report.level = this.profile.level;
    report.levelsGained = report.level - report.levelBefore;
    if (report.levelsGained > 0) this.events?.emit('level.up', { level: report.level });

    report.heroesUnlocked = this.#unlockedCoreHeroIds()
      .filter((id) => !report.unlockedBefore.has(id))
      .map((id) => this.library.get(id));
    report.heroesUnlocked.forEach((hero) => this.events?.emit('hero.unlocked', { id: hero.id, name: hero.name }));
    delete report.unlockedBefore;
    delete report.levelBefore;

    this.#save();
    return report;
  }

  #unlockedCoreHeroIds() {
    return this.library.heroes({ source: ContentSource.CORE })
      .filter((hero) => this.unlocks.isUnlocked(hero))
      .map((hero) => hero.id);
  }

  #save() {
    this.store?.save(this.profile.toJSON());
  }
}
