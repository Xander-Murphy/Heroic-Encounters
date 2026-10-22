import { Prototype } from './Prototype.js';
import { SpellSchool, TargetType } from './types.js';

/**
 * Something a character can do in combat.
 *
 * An ability owns its cooldown and a list of AbilityEffects (Composition). It
 * knows nothing about who is fighting whom; targeting and turn order live in
 * the targeting and Combat modules.
 */
export class Ability extends Prototype {
  constructor({
    id = '',
    name,
    description = '',
    power = 0,
    cooldown = 0,
    target = TargetType.SINGLE_ENEMY,
    school = SpellSchool.PHYSICAL,
    priority = 0,
    effects = [],
    animation = null,
  }) {
    super();
    this.id = id;
    this.name = name;
    this.description = description;
    this.power = power;
    this.cooldown = cooldown;
    this.currentCooldown = 0;
    this.target = target;
    this.school = school;
    this.priority = priority;
    this.effects = [...effects];
    this.animation = animation;
  }

  /** True for abilities that help their targets (heals, buffs, cleanses). */
  get isSupportive() {
    return this.effects.length > 0 && this.effects.every((effect) => effect.isSupportive);
  }

  isReady() {
    return this.currentCooldown === 0;
  }

  /** Start the cooldown. Returns false if the ability wasn't ready. */
  use() {
    if (!this.isReady()) return false;
    // +1 because cooldowns tick at the end of the round the ability is used in;
    // a cooldown of 1 therefore means "skip one round".
    this.currentCooldown = this.cooldown ? this.cooldown + 1 : 0;
    return true;
  }

  /** Run every effect on every living target and return the EffectResults. */
  apply(source, targets) {
    const results = [];
    for (const target of targets) {
      for (const effect of this.effects) {
        if (!target.isAlive()) break;
        results.push(...[effect.apply(source, target, this)].flat());
      }
    }
    return results;
  }

  reduceCooldown() {
    if (this.currentCooldown > 0) this.currentCooldown -= 1;
  }

  resetCooldown() {
    this.currentCooldown = 0;
  }

  summary() {
    return this.effects.map((effect) => effect.summary(this)).filter(Boolean).join('. ');
  }
}
