import { resolverFor } from './targeting.js';
import { Stat } from './types.js';

/** One character using one ability on some targets this round. */
export class Action {
  constructor(actor, ability, targets) {
    this.actor = actor;
    this.ability = ability;
    this.targets = [...targets];
    this.priority = actor.getStat(Stat.SPEED) + ability.priority;
  }

  hasLivingTarget() {
    return this.targets.some((target) => target.isAlive());
  }

  /**
   * Re-check a single chosen target just before acting. If it is no longer
   * a valid target, pick the first valid one instead:
   * - it died earlier in the round (so the turn isn't wasted), or
   * - a taunt cast earlier this round now forces a different target.
   * Returns true when a living target was swapped out because of a taunt.
   */
  retarget(battlefield) {
    const resolver = resolverFor(this.ability.target);
    if (!resolver.requiresChoice) return false;
    const candidates = resolver.candidates(this.actor, battlefield);
    if (this.targets.every((target) => candidates.includes(target))) return false;

    const taunted = this.hasLivingTarget();
    this.targets = resolver.resolve(this.actor, battlefield, 0);
    return taunted && this.targets.length > 0;
  }

  canExecute() {
    return this.actor.canAct() && this.ability.isReady() && this.hasLivingTarget();
  }

  /**
   * Spend the cooldown and apply the ability. Returns the EffectResults, or
   * an empty list if the action couldn't be performed.
   */
  execute() {
    if (!this.canExecute()) return [];
    this.ability.use();
    return this.ability.apply(this.actor, this.targets);
  }

  describe() {
    const names = this.targets.length === 1 ? this.targets[0].name : `${this.targets.length} targets`;
    return `${this.ability.name} → ${names}`;
  }
}
