import { Prototype } from './Prototype.js';
import { EffectType, HARMFUL_EFFECT_TYPES, Stat } from './types.js';

/**
 * A buff, debuff, damage/heal over time, immunity, stun or taunt on a character.
 *
 * The effect only answers questions about itself (is it active, what does it
 * add to a stat, how much does it tick for); the Character decides what to do
 * with those answers. That keeps each class focused on one job (SRP).
 */
export class StatusEffect extends Prototype {
  constructor({
    id = '',
    name,
    type,
    category,
    magnitude = 0,
    duration = 1,
    schools = [],
    stat = null,
    tickSchool = null,
    description = '',
    icon = '✨',
  }) {
    super();
    this.id = id;
    this.name = name;
    this.type = type;
    this.category = category;
    this.magnitude = magnitude;
    this.duration = duration;
    this.remainingDuration = duration;
    this.schools = [...schools];
    this.stat = stat;
    this.tickSchool = tickSchool;
    this.description = description;
    this.icon = icon;
  }

  get isHarmful() {
    return HARMFUL_EFFECT_TYPES.includes(this.type);
  }

  isActive() {
    return this.remainingDuration > 0;
  }

  reduceDuration() {
    if (this.remainingDuration > 0) this.remainingDuration -= 1;
  }

  damagePerRound() {
    return this.isActive() && this.type === EffectType.DAMAGE_OVER_TIME ? this.magnitude : 0;
  }

  healingPerRound() {
    return this.isActive() && this.type === EffectType.HEAL_OVER_TIME ? this.magnitude : 0;
  }

  affectsSchool(school) {
    return this.schools.includes(school);
  }

  grantsImmunityTo(school) {
    return this.isActive() && this.type === EffectType.IMMUNITY && this.affectsSchool(school);
  }

  preventsActing() {
    return this.isActive() && this.type === EffectType.STUN;
  }

  forcesTargeting() {
    return this.isActive() && this.type === EffectType.TAUNT;
  }

  /**
   * Signed amount this effect adds to `stat` (0 if it doesn't touch it).
   * Resistance modifiers only apply to the schools the effect lists.
   */
  modifierFor(stat, school = null) {
    if (!this.isActive() || this.stat !== stat) return 0;
    if (stat === Stat.RESISTANCE && !this.affectsSchool(school)) return 0;
    if (this.type === EffectType.BUFF) return this.magnitude;
    if (this.type === EffectType.DEBUFF) return -this.magnitude;
    return 0;
  }

  /** Plain-language summary for tooltips and editors. */
  describe() {
    if (this.description) return this.description;
    const schools = this.schools.join(', ');
    switch (this.type) {
      case EffectType.BUFF:
      case EffectType.DEBUFF: {
        const sign = this.type === EffectType.BUFF ? '+' : '-';
        const suffix = this.stat === Stat.RESISTANCE ? `% ${schools} resistance` : ` ${this.stat}`;
        return `${sign}${this.magnitude}${suffix}.`;
      }
      case EffectType.DAMAGE_OVER_TIME: return `Takes ${this.magnitude} ${this.tickSchool || ''} damage each round.`;
      case EffectType.HEAL_OVER_TIME: return `Heals ${this.magnitude} each round.`;
      case EffectType.IMMUNITY: return `Immune to ${schools} damage.`;
      case EffectType.STUN: return 'Cannot act.';
      case EffectType.TAUNT: return 'Enemies must target this character.';
      default: return '';
    }
  }
}
