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
   * If a single chosen target died earlier in the round, pick the first
   * remaining valid target instead (so a turn isn't wasted).
   */
  retarget(battlefield) {
    const resolver = resolverFor(this.ability.target);
    if (!resolver.requiresChoice || this.hasLivingTarget()) return;
    this.targets = resolver.resolve(this.actor, battlefield, 0);
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
