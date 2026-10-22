import { SHARED } from '../Prototype.js';
import { ResultKind, Stat } from '../types.js';
import { EffectResult } from './EffectResult.js';

/**
 * Ability power scaled by the source's attack as a percentage bonus.
 * Kept in one place so damage and healing balance from the same formula.
 */
export function scaleByAttack(source, power) {
  return Math.round(power * (1 + source.getStat(Stat.ATTACK) / 100));
}

/**
 * One thing an ability does to a single target.
 *
 * An Ability holds a list of these and applies each in order (Composition).
 * A new kind of ability behavior is a new subclass registered with the
 * EffectRegistry; Ability, Action and Combat never change (Open/Closed).
 * Every subclass can stand in for this base class wherever an ability runs
 * its effects (Liskov).
 */
export class AbilityEffect {
  /** Key used in content definitions, e.g. { "type": "damage" }. */
  static type = 'abstract';

  /** Build an effect from its JSON definition. */
  static fromDefinition(_definition, _factory) {
    return new this();
  }

  /**
   * Apply the effect to `target` and describe what happened.
   * @returns {EffectResult | EffectResult[]}
   */
  apply(_source, _target, _ability) {
    throw new Error(`${this.constructor.name} must implement apply()`);
  }

  /** True when this effect helps its target (used by enemy AI and targeting hints). */
  get isSupportive() {
    return false;
  }

  /** Rough value used by the power-budget rating. */
  budgetValue(ability) {
    return ability.power * 0.5;
  }

  /** Short text for tooltips, e.g. "Deals damage". */
  summary(_ability) {
    return '';
  }
}

export class DamageEffect extends AbilityEffect {
  static type = 'damage';

  apply(source, target, ability) {
    const school = ability.school;

    if (target.isImmuneTo(school)) {
      return new EffectResult({
        source, target, ability, school,
        kind: ResultKind.IMMUNE,
        description: `${target.name} is immune to ${ability.name}`,
      });
    }

    const dealt = target.takeDamage(scaleByAttack(source, ability.power), school);
    const defeated = !target.isAlive();
    return new EffectResult({
      source, target, ability, school, defeated,
      kind: ResultKind.DAMAGE,
      amount: dealt,
      description: `${source.name}'s ${ability.name} hits ${target.name} for ${dealt}${defeated ? ' — defeated!' : ''}`,
    });
  }

  budgetValue(ability) {
    return ability.power;
  }

  summary(ability) {
    return `Deals ${ability.power} ${ability.school} damage`;
  }
}

export class HealEffect extends AbilityEffect {
  static type = 'heal';

  get isSupportive() {
    return true;
  }

  apply(source, target, ability) {
    const restored = target.heal(scaleByAttack(source, ability.power));
    return new EffectResult({
      source, target, ability,
      school: ability.school,
      kind: ResultKind.HEAL,
      amount: restored,
      description: `${source.name}'s ${ability.name} heals ${target.name} for ${restored}`,
    });
  }

  budgetValue(ability) {
    return ability.power * 1.1;
  }

  summary(ability) {
    return `Heals ${ability.power}`;
  }
}

/** Deals damage, then heals the source for a share of the damage dealt. */
export class LifestealEffect extends DamageEffect {
  static type = 'lifesteal';

  static fromDefinition(definition) {
    return new this(definition.percent ?? 50);
  }

  constructor(percent = 50) {
    super();
    this.percent = percent;
  }

  apply(source, target, ability) {
    const hit = super.apply(source, target, ability);
    if (hit.kind !== ResultKind.DAMAGE || hit.amount <= 0) return hit;

    const restored = source.heal(Math.round(hit.amount * this.percent / 100));
    const drain = new EffectResult({
      source, ability,
      target: source,
      school: ability.school,
      kind: ResultKind.HEAL,
      amount: restored,
      description: `${source.name} drains ${restored} health`,
    });
    return [hit, drain];
  }

  budgetValue(ability) {
    return ability.power * (1 + this.percent / 200);
  }

  summary(ability) {
    return `Deals ${ability.power} ${ability.school} damage and heals for ${this.percent}% of it`;
  }
}

/** Gives the target its own copy of a StatusEffect prototype. */
export class ApplyStatusEffect extends AbilityEffect {
  static type = 'status';

  static fromDefinition(definition, factory) {
    return new this(factory.createStatusEffect(definition.status));
  }

  constructor(status) {
    super();
    this.status = status;
  }

  get isSupportive() {
    return !this.status.isHarmful;
  }

  apply(source, target, ability) {
    target.addEffect(this.status.clone());
    return new EffectResult({
      source, target, ability,
      school: ability.school,
      kind: ResultKind.STATUS,
      description: `${target.name} gains ${this.status.name}`,
    });
  }

  budgetValue() {
    const status = this.status;
    const perRound = {
      damage_over_time: status.magnitude,
      heal_over_time: status.magnitude,
      buff: status.magnitude * 1.5,
      debuff: status.magnitude * 1.5,
      immunity: 18,
      stun: 30,
      taunt: 12,
    }[status.type] ?? 5;
    // Resistance is a percentage, so a point of it is worth less than a point of attack/defense
    const statWeight = status.stat === 'resistance' ? 0.4 : 1;
    return perRound * statWeight * status.duration;
  }

  summary() {
    return `Applies ${this.status.name} (${this.status.duration}r)`;
  }
}

/** Removes harmful (or, against enemies, helpful) effects of some categories. */
export class DispelEffect extends AbilityEffect {
  static type = 'dispel';

  static fromDefinition(definition) {
    return new this(definition.categories ?? [], definition.harmful ?? true);
  }

  constructor(categories = [], harmful = true) {
    super();
    this.categories = [...categories];
    this.harmful = harmful;
  }

  get isSupportive() {
    return this.harmful;
  }

  apply(source, target, ability) {
    const removed = target.removeEffects(
      (effect) => this.categories.includes(effect.category) && effect.isHarmful === this.harmful,
    );
    const names = removed.map((effect) => effect.name).join(', ') || 'nothing';
    return new EffectResult({
      source, target, ability,
      school: ability.school,
      kind: ResultKind.DISPEL,
      amount: removed.length,
      description: `${ability.name} removes ${names} from ${target.name}`,
    });
  }

  budgetValue() {
    return 6 * this.categories.length;
  }

  summary() {
    return `Removes ${this.harmful ? 'harmful' : 'helpful'} ${this.categories.join('/')} effects`;
  }
}

// Effects hold no per-fight state (statuses are cloned on apply), so clones may share them.
for (const EffectClass of [DamageEffect, HealEffect, LifestealEffect, ApplyStatusEffect, DispelEffect]) {
  Object.defineProperty(EffectClass.prototype, SHARED, { value: true });
}
