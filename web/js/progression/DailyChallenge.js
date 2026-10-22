import { Random } from '../engine/Random.js';
import { createModifier, MODIFIER_POOL } from '../engine/RunModifier.js';
import { dateKey } from './dates.js';

/**
 * Today's challenge: the same dungeon, team and twist for every player,
 * derived from the date. Locked heroes can appear here, giving players a
 * taste of heroes they haven't unlocked yet.
 *
 * It is a reason to come back tomorrow (Business.md key metric: return rate
 * after 1 and 7 days), and streaks reward coming back.
 */
export class DailyChallenge {
  constructor({ key, seed, dungeonId, heroIds, modifier }) {
    this.key = key;
    this.seed = seed;
    this.dungeonId = dungeonId;
    this.heroIds = heroIds;
    this.modifierSpec = modifier;
  }

  static forDate(library, date = new Date()) {
    const key = dateKey(date);
    const rng = Random.fromString(`heroic-encounters:daily:${key}`);
    const dungeons = library.dungeons({ source: 'core' });
    const heroes = library.heroes({ source: 'core' });
    return new DailyChallenge({
      key,
      seed: rng.int(2 ** 31),
      dungeonId: rng.pick(dungeons).id,
      heroIds: rng.shuffle(heroes.map((hero) => hero.id)).slice(0, 3),
      modifier: rng.pick(MODIFIER_POOL),
    });
  }

  createModifier() {
    return createModifier(this.modifierSpec);
  }

  /** Random for the run itself, so every player meets the same enemies. */
  createRandom() {
    return new Random(this.seed);
  }
}
