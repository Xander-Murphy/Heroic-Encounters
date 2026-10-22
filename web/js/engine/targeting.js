import { SHARED } from './Prototype.js';
import { TargetType } from './types.js';

/**
 * The two sides of a fight, seen from any actor's point of view.
 * "Ally" and "enemy" are relative: a hero's enemies are the monsters,
 * a monster's enemies are the heroes.
 */
export class Battlefield {
  constructor(heroes, enemies) {
    this.heroes = heroes;
    this.enemies = enemies;
  }

  alliesOf(actor) {
    return this.#isHero(actor) ? this.heroes : this.enemies;
  }

  enemiesOf(actor) {
    return this.#isHero(actor) ? this.enemies : this.heroes;
  }

  includes(actor) {
    return this.heroes.includes(actor) || this.enemies.includes(actor);
  }

  #isHero(actor) {
    if (this.heroes.includes(actor)) return true;
    if (this.enemies.includes(actor)) return false;
    throw new Error(`${actor.name} is not part of this battlefield`);
  }
}

const living = (characters) => characters.filter((character) => character.isAlive());

/**
 * Decides who an ability can hit.
 *
 * Subclasses only say which characters are valid candidates and whether the
 * player must pick one (requiresChoice). Everything else is shared, so a new
 * targeting rule is one small subclass (Open/Closed).
 */
export class TargetResolver {
  get requiresChoice() {
    return false;
  }

  /** Every living character this ability could target. */
  candidates(_actor, _battlefield) {
    throw new Error(`${this.constructor.name} must implement candidates()`);
  }

  /**
   * The characters the ability will actually hit. `choice` is an index into
   * candidates(); it's only used when a single target has to be picked.
   * An invalid choice resolves to no targets.
   */
  resolve(actor, battlefield, choice = 0) {
    const candidates = this.candidates(actor, battlefield);
    if (!this.requiresChoice) return candidates;
    return choice >= 0 && choice < candidates.length ? [candidates[choice]] : [];
  }
}

class SelfResolver extends TargetResolver {
  candidates(actor) {
    return living([actor]);
  }
}

class SingleAllyResolver extends TargetResolver {
  get requiresChoice() {
    return true;
  }

  candidates(actor, battlefield) {
    return living(battlefield.alliesOf(actor));
  }
}

class AllAlliesResolver extends TargetResolver {
  candidates(actor, battlefield) {
    return living(battlefield.alliesOf(actor));
  }
}

/** A taunting opponent must be the target of single-target attacks. */
class SingleEnemyResolver extends TargetResolver {
  get requiresChoice() {
    return true;
  }

  candidates(actor, battlefield) {
    const opponents = living(battlefield.enemiesOf(actor));
    const taunting = opponents.filter((opponent) => opponent.isTaunting());
    return taunting.length ? taunting : opponents;
  }
}

class AllEnemiesResolver extends TargetResolver {
  candidates(actor, battlefield) {
    return living(battlefield.enemiesOf(actor));
  }
}

// Resolvers hold no state, so one shared instance per target type is enough.
const RESOLVERS = Object.freeze({
  [TargetType.SELF]: new SelfResolver(),
  [TargetType.SINGLE_ALLY]: new SingleAllyResolver(),
  [TargetType.ALL_ALLIES]: new AllAlliesResolver(),
  [TargetType.SINGLE_ENEMY]: new SingleEnemyResolver(),
  [TargetType.ALL_ENEMIES]: new AllEnemiesResolver(),
});
Object.values(RESOLVERS).forEach((resolver) => Object.defineProperty(resolver, SHARED, { value: true }));

export function resolverFor(targetType) {
  const resolver = RESOLVERS[targetType];
  if (!resolver) throw new Error(`Unknown target type: ${targetType}`);
  return resolver;
}
