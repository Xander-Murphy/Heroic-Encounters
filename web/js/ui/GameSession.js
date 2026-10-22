import { DungeonRun } from '../engine/DungeonRun.js';
import { Random } from '../engine/Random.js';
import { DailyChallenge } from '../progression/DailyChallenge.js';

/**
 * Holds the run in progress and the last team/dungeon picked, and knows how
 * to start a normal run or today's daily challenge. Screens ask the session
 * instead of building runs themselves (Single Responsibility).
 */
export class GameSession {
  constructor(services) {
    this.services = services;
    this.run = null;
    this.lastTeam = [];
    this.lastDungeonId = null;
  }

  dailyChallenge() {
    return DailyChallenge.forDate(this.services.library);
  }

  startRun({ dungeonId, heroIds }) {
    const { library } = this.services;
    this.lastTeam = [...heroIds];
    this.lastDungeonId = dungeonId;
    this.run = new DungeonRun({
      dungeon: library.get(dungeonId),
      party: heroIds.map((id) => library.instantiate(id)),
      enemyFactory: library.enemyFactory,
      rng: new Random(),
    });
    this.services.progression.recordRunStart(this.run);
    return this.run;
  }

  startDaily() {
    const { library } = this.services;
    const daily = this.dailyChallenge();
    this.run = new DungeonRun({
      dungeon: library.get(daily.dungeonId),
      party: daily.heroIds.map((id) => library.instantiate(id)),
      enemyFactory: library.enemyFactory,
      rng: daily.createRandom(),
      modifiers: [daily.createModifier()],
      tags: { daily: daily.key },
    });
    this.services.progression.recordRunStart(this.run);
    return this.run;
  }

  endRun() {
    const run = this.run;
    this.run = null;
    return run;
  }
}
