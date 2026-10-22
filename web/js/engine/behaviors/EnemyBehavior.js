import { Action } from '../Action.js';
import { SHARED } from '../Prototype.js';
import { resolverFor } from '../targeting.js';
import { TargetType } from '../types.js';

const healthPercent = (character) => character.health / character.maxHealth;

/**
 * Decides what an enemy does on its turn (Strategy pattern).
 *
 * Each Enemy holds one of these. A new kind of enemy brain is a new subclass
 * registered in BehaviorRegistry; Enemy and Combat don't change (Open/Closed).
 * Behaviors are stateless — randomness comes from the fight's Random — so one
 * instance is shared by every enemy that uses it.
 *
 * Subclasses override chooseAbility() and/or chooseTargetIndex().
 */
export class EnemyBehavior {
  static id = 'abstract';
  static label = 'Abstract';
  static description = '';

  constructor() {
    Object.defineProperty(this, SHARED, { value: true });
  }

  /** The Action `enemy` wants to take, or null if it has no valid move. */
  chooseAction(enemy, battlefield, rng) {
    const ability = this.chooseAbility(enemy, battlefield, rng);
    if (!ability) return null;

    const resolver = resolverFor(ability.target);
    const candidates = resolver.candidates(enemy, battlefield);
    if (!candidates.length) return null;

    const index = resolver.requiresChoice
      ? this.chooseTargetIndex(candidates, ability, enemy, rng)
      : 0;
    const targets = resolver.resolve(enemy, battlefield, index);
    return targets.length ? new Action(enemy, ability, targets) : null;
  }

  /** Default: any usable ability (the basic attack counts as one option). */
  chooseAbility(enemy, _battlefield, rng) {
    return rng.pick(this.usefulAbilities(enemy, _battlefield));
  }

  /** Default: a random valid target. */
  chooseTargetIndex(candidates, _ability, _enemy, rng) {
    return rng.int(candidates.length);
  }

  // --- Helpers shared by subclasses ---------------------------------------

  /** Usable abilities, minus heals when nobody on its side is hurt. */
  usefulAbilities(enemy, battlefield) {
    const anyoneHurt = battlefield.alliesOf(enemy).some((ally) => ally.isAlive() && healthPercent(ally) < 0.9);
    const useful = enemy.usableAbilities().filter((ability) => !ability.isSupportive
      || ability.target === TargetType.SELF
      || anyoneHurt);
    return useful.length ? useful : [enemy.basicAttack];
  }

  supportiveFor(enemy) {
    return enemy.usableAbilities().filter((ability) => ability.isSupportive);
  }

  offensiveFor(enemy) {
    return enemy.usableAbilities().filter((ability) => !ability.isSupportive);
  }

  strongest(abilities) {
    return abilities.reduce((best, ability) => (ability.power > best.power ? ability : best), abilities[0]);
  }

  /** Index of the candidate with the lowest score. */
  indexOfMin(candidates, score) {
    let best = 0;
    candidates.forEach((candidate, index) => {
      if (score(candidate) < score(candidates[best])) best = index;
    });
    return best;
  }

  /** Friendly single-target abilities go to the most hurt ally. */
  supportTargetIndex(candidates, ability) {
    return ability.isSupportive ? this.indexOfMin(candidates, healthPercent) : null;
  }
}

/** Picks a random usable ability and a random target. */
export class RandomBehavior extends EnemyBehavior {
  static id = 'random';
  static label = 'Unpredictable';
  static description = 'Uses a random ability on a random target.';

  chooseTargetIndex(candidates, ability, enemy, rng) {
    return this.supportTargetIndex(candidates, ability) ?? rng.int(candidates.length);
  }
}

/** Hits as hard as it can, always at the most wounded hero. */
export class AggressiveBehavior extends EnemyBehavior {
  static id = 'aggressive';
  static label = 'Ferocious';
  static description = 'Uses its strongest attack on the most wounded hero.';

  chooseAbility(enemy) {
    const offensive = this.offensiveFor(enemy);
    return this.strongest(offensive.length ? offensive : [enemy.basicAttack]);
  }

  chooseTargetIndex(candidates, ability) {
    return this.supportTargetIndex(candidates, ability) ?? this.indexOfMin(candidates, (hero) => hero.health);
  }
}

/** Heals and shields its allies when they are hurt; otherwise attacks. */
export class SupportBehavior extends EnemyBehavior {
  static id = 'support';
  static label = 'Protector';
  static description = 'Heals or shields hurt allies first, then attacks.';

  chooseAbility(enemy, battlefield, rng) {
    const allies = battlefield.alliesOf(enemy).filter((ally) => ally.isAlive());
    const someoneHurt = allies.some((ally) => healthPercent(ally) < 0.6);
    const support = this.supportiveFor(enemy);
    if (support.length && someoneHurt) return this.strongest(support);
    const offensive = this.offensiveFor(enemy);
    return offensive.length ? rng.pick(offensive) : enemy.basicAttack;
  }

  chooseTargetIndex(candidates, ability, enemy, rng) {
    return this.supportTargetIndex(candidates, ability) ?? rng.int(candidates.length);
  }
}

/** Goes after the party's biggest damage dealer and saves area attacks for crowds. */
export class CunningBehavior extends EnemyBehavior {
  static id = 'cunning';
  static label = 'Cunning';
  static description = 'Targets your strongest attacker and saves area attacks for groups.';

  chooseAbility(enemy, battlefield, rng) {
    const heroesStanding = battlefield.enemiesOf(enemy).filter((hero) => hero.isAlive()).length;
    const useful = this.usefulAbilities(enemy, battlefield);
    const area = useful.filter((ability) => ability.target === TargetType.ALL_ENEMIES);
    if (area.length && heroesStanding >= 2) return this.strongest(area);
    const buffs = useful.filter((ability) => ability.isSupportive);
    if (buffs.length && rng.chance(0.5)) return rng.pick(buffs);
    const single = useful.filter((ability) => ability.target === TargetType.SINGLE_ENEMY);
    return single.length ? this.strongest(single) : rng.pick(useful);
  }

  chooseTargetIndex(candidates, ability) {
    return this.supportTargetIndex(candidates, ability)
      ?? this.indexOfMin(candidates, (hero) => -hero.attack);
  }
}
