import { Combat } from './Combat.js';
import { Random } from './Random.js';
import { ResultKind } from './types.js';

export const RunState = Object.freeze({
  READY: 'ready',
  FIGHTING: 'fighting',
  WON: 'won',
  LOST: 'lost',
});

/** Totals for one run, used by the summary screen, achievements and metrics. */
export class RunStats {
  constructor() {
    this.rounds = 0;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.healingDone = 0;
    this.enemiesDefeated = 0;
    this.encountersWon = 0;
    this.enemiesSeen = new Set();
    this.bossDefeated = false;
  }

  record(results) {
    for (const result of results) {
      const heroSource = result.source?.isHero;
      if (result.kind === ResultKind.DAMAGE) {
        if (result.target.isHero) this.damageTaken += result.amount;
        else this.damageDealt += result.amount;
        if (result.defeated && !result.target.isHero) this.enemiesDefeated += 1;
      } else if (result.kind === ResultKind.HEAL && (heroSource || result.target.isHero)) {
        this.healingDone += result.amount;
      }
    }
  }

  toJSON() {
    return { ...this, enemiesSeen: [...this.enemiesSeen] };
  }
}

/**
 * One trip through a dungeon: a series of encounters ending with the boss.
 *
 * The run owns the party's clones, so health carries between encounters,
 * with a partial rest after each win. It depends on an `enemyFactory`
 * function rather than on any content storage (Dependency Inversion), so
 * built-in and player-made enemies work the same way.
 */
export class DungeonRun {
  constructor({ dungeon, party, enemyFactory, rng = new Random(), modifiers = [], tags = {} }) {
    this.dungeon = dungeon;
    this.enemyFactory = enemyFactory;
    this.rng = rng;
    // Spawns use their own stream, so the waves a seed produces don't depend on
    // the choices made in combat (everyone meets the same daily-challenge enemies).
    this.spawnRng = new Random((rng.seed ^ 0x5bd1e995) >>> 0);
    this.modifiers = modifiers;
    this.tags = tags;
    this.party = party.map((hero) => hero.clone());
    this.waveIndex = 0;
    this.combat = null;
    this.state = RunState.READY;
    this.stats = new RunStats();
    this.log = []; // [{ wave, round, lines[] }]
    this.modifiers.forEach((modifier) => modifier.onPartyCreated(this.party));
  }

  get totalWaves() {
    return this.dungeon.waves.length + 1;
  }

  get isBossWave() {
    return this.waveIndex === this.dungeon.waves.length;
  }

  get waveLabel() {
    return this.isBossWave ? 'Boss' : `Wave ${this.waveIndex + 1} of ${this.dungeon.waves.length}`;
  }

  get isOver() {
    return this.state === RunState.WON || this.state === RunState.LOST;
  }

  get reachedBoss() {
    return this.waveIndex >= this.dungeon.waves.length;
  }

  heroesLost() {
    return this.party.filter((hero) => !hero.isAlive()).length;
  }

  /** Build the next encounter's enemies and start the fight. */
  startEncounter() {
    if (this.isOver) return null;
    const enemies = this.#spawnEnemies();
    this.modifiers.forEach((modifier) => modifier.onEnemiesSpawned(enemies, this));
    enemies.forEach((enemy) => this.stats.enemiesSeen.add(enemy.contentId));

    this.combat = new Combat(this.party, enemies, { rng: this.rng });
    this.state = RunState.FIGHTING;
    this.note(this.isBossWave
      ? `— Boss: ${enemies.map((enemy) => enemy.name).join(', ')} appears! —`
      : `— ${this.waveLabel}: ${enemies.map((enemy) => enemy.name).join(', ')} —`);
    return this.combat;
  }

  /** Add a line to the run log under the current wave and round. */
  note(text, round = this.combat?.roundNumber ?? 1) {
    let entry = this.log[this.log.length - 1];
    if (!entry || entry.wave !== this.waveIndex || entry.round !== round) {
      entry = { wave: this.waveIndex, round, label: this.waveLabel, lines: [] };
      this.log.push(entry);
    }
    entry.lines.push(text);
  }

  /** Add results to the stats and the log. `round` defaults to the current round. */
  record(results, round = this.combat?.roundNumber ?? 1) {
    this.stats.record(results);
    results.forEach((result) => this.note(result.description, round));
  }

  /** The party retreats: the run ends as a loss. */
  abandon() {
    if (this.isOver) return;
    if (this.combat) this.stats.rounds += this.combat.roundNumber;
    this.state = RunState.LOST;
    this.note('The party retreats from the dungeon.');
  }

  /**
   * Call once the current combat is over. Moves the run on: a loss ends it,
   * a win either finishes the dungeon (boss) or rests the party for the next wave.
   */
  finishEncounter() {
    const combat = this.combat;
    if (!combat || !combat.isOver()) return this.state;
    this.stats.rounds += combat.roundNumber;

    if (!combat.heroesWon()) {
      this.state = RunState.LOST;
      return this.state;
    }

    this.stats.encountersWon += 1;
    if (this.isBossWave) {
      this.stats.bossDefeated = true;
      this.state = RunState.WON;
      return this.state;
    }

    const rest = this.modifiers.reduce((percent, modifier) => modifier.restPercent(percent), this.dungeon.restBetweenWaves ?? 0.25);
    this.party.filter((hero) => hero.isAlive()).forEach((hero) => hero.rest(rest));
    this.waveIndex += 1;
    this.combat = null;
    this.state = RunState.READY;
    if (rest > 0) this.note(`Survivors recover ${Math.round(rest * 100)}% health.`);
    return this.state;
  }

  #spawnEnemies() {
    if (this.isBossWave) {
      const boss = this.enemyFactory(this.dungeon.boss);
      return boss ? [boss] : [];
    }
    const wave = this.dungeon.waves[this.waveIndex];
    const count = this.spawnRng.between(wave.min ?? 1, wave.max ?? wave.min ?? 1);
    const scaling = 1 + (this.dungeon.scaling ?? 0.1) * this.waveIndex;
    const enemies = [];
    for (let i = 0; i < count; i++) {
      const enemy = this.enemyFactory(this.spawnRng.pick(wave.enemies));
      if (enemy) enemies.push(enemy.scale(scaling));
    }
    return enemies;
  }
}
