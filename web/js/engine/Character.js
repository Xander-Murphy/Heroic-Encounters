import { Prototype } from './Prototype.js';
import { EffectResult } from './effects/EffectResult.js';
import { ResultKind, Side, Stat } from './types.js';

let nextUid = 1;

/**
 * Shared base for heroes and enemies (Inheritance).
 *
 * A character owns its health, stats, abilities and active status effects
 * (Encapsulation): other classes ask it to take damage, heal or gain an
 * effect rather than editing those fields directly.
 */
export class Character extends Prototype {
  constructor({
    contentId = '',
    name,
    side,
    health,
    attack,
    defense = 0,
    speed = 5,
    resistances = {},
    abilities = [],
    basicAttack,
    portrait = '❔',
    theme = null,
    lore = '',
  }) {
    super();
    this.uid = nextUid++;
    this.contentId = contentId;
    this.name = name;
    this.side = side;
    this.maxHealth = health;
    this.health = health;
    this.attack = attack;
    this.defense = defense;
    this.speed = speed;
    this.resistances = { ...resistances };
    this.abilities = [...abilities];
    // Available at all times, whatever the abilities' cooldowns
    this.basicAttack = basicAttack;
    this.activeEffects = [];
    this.portrait = portrait;
    this.theme = theme;
    this.lore = lore;
  }

  onClone() {
    this.uid = nextUid++;
  }

  get isHero() {
    return this.side === Side.HERO;
  }

  /** Label shown under the card name, e.g. "Mage · Arcane". Overridden by subclasses. */
  get typeLine() {
    return '';
  }

  isAlive() {
    return this.health > 0;
  }

  /** Alive and not stunned. */
  canAct() {
    return this.isAlive() && !this.activeEffects.some((effect) => effect.preventsActing());
  }

  isTaunting() {
    return this.isAlive() && this.activeEffects.some((effect) => effect.forcesTargeting());
  }

  /** Abilities off cooldown, plus the basic attack, which is always available. */
  usableAbilities() {
    return [...this.abilities.filter((ability) => ability.isReady()), this.basicAttack];
  }

  allAbilities() {
    return [...this.abilities, this.basicAttack];
  }

  canUse(ability) {
    return this.usableAbilities().includes(ability);
  }

  /** Base attack/defense/speed plus any active buffs and debuffs. */
  getStat(stat) {
    const base = { [Stat.ATTACK]: this.attack, [Stat.DEFENSE]: this.defense, [Stat.SPEED]: this.speed }[stat] ?? 0;
    return base + this.activeEffects.reduce((sum, effect) => sum + effect.modifierFor(stat), 0);
  }

  /** Base resistance (a percentage) plus active resistance buffs/debuffs, capped at 90%. */
  getResistance(school) {
    const total = (this.resistances[school] ?? 0)
      + this.activeEffects.reduce((sum, effect) => sum + effect.modifierFor(Stat.RESISTANCE, school), 0);
    return Math.min(90, total);
  }

  isImmuneTo(school) {
    return this.activeEffects.some((effect) => effect.grantsImmunityTo(school));
  }

  /**
   * Apply incoming damage and return how much health was actually lost.
   * Order: immunity -> resistance (percentage) -> defense (flat). A hit that
   * gets through always deals at least 1.
   */
  takeDamage(amount, school = null) {
    let incoming = amount;
    if (school !== null) {
      if (this.isImmuneTo(school)) return 0;
      incoming *= 1 - this.getResistance(school) / 100;
    }
    return this.loseHealth(Math.max(1, Math.round(incoming) - Math.max(0, this.getStat(Stat.DEFENSE))));
  }

  /** Remove health directly (no defense/resistance) and return the amount. */
  loseHealth(amount) {
    const lost = Math.min(Math.max(0, amount), this.health);
    this.health -= lost;
    return lost;
  }

  /** Restore health (capped at maxHealth) and return the amount restored. */
  heal(amount) {
    if (!this.isAlive()) return 0;
    const restored = Math.min(Math.max(0, amount), this.maxHealth - this.health);
    this.health += restored;
    return restored;
  }

  /** Re-applying an effect refreshes it rather than stacking a duplicate. */
  addEffect(effect) {
    this.activeEffects = this.activeEffects.filter((existing) => existing.name !== effect.name);
    this.activeEffects.push(effect);
  }

  /** Remove every effect matching `predicate` and return the removed effects. */
  removeEffects(predicate) {
    const removed = this.activeEffects.filter(predicate);
    this.activeEffects = this.activeEffects.filter((effect) => !removed.includes(effect));
    return removed;
  }

  /**
   * Hook run after this character is hit, so subclasses (bosses) can react.
   * @returns {EffectResult[]}
   */
  checkPhaseTransitions() {
    return [];
  }

  /**
   * Round-end upkeep: damage and healing over time, then effect and cooldown ticks.
   * Damage over time goes through takeDamage in the effect's school, so
   * resistance, immunity and defense apply like any other damage.
   */
  endRound() {
    const results = [];

    for (const effect of this.activeEffects) {
      const damage = effect.damagePerRound();
      if (damage > 0 && this.isAlive()) {
        const school = effect.tickSchool;
        if (school && this.isImmuneTo(school)) {
          results.push(new EffectResult({
            target: this, kind: ResultKind.IMMUNE, school,
            description: `${this.name} is immune to ${effect.name}`,
          }));
        } else {
          const dealt = this.takeDamage(damage, school);
          results.push(new EffectResult({
            target: this, kind: ResultKind.DAMAGE, amount: dealt, school,
            defeated: !this.isAlive(),
            description: `${this.name} takes ${dealt} damage from ${effect.name}${this.isAlive() ? '' : ' — defeated!'}`,
          }));
        }
      }

      const healing = effect.healingPerRound();
      if (healing > 0 && this.isAlive()) {
        const restored = this.heal(healing);
        results.push(new EffectResult({
          target: this, kind: ResultKind.HEAL, amount: restored,
          description: `${this.name} recovers ${restored} from ${effect.name}`,
        }));
      }
    }

    this.activeEffects.forEach((effect) => effect.reduceDuration());
    this.activeEffects = this.activeEffects.filter((effect) => effect.isActive());
    this.abilities.forEach((ability) => ability.reduceCooldown());
    return results;
  }

  /** Between encounters: clear effects and cooldowns, recover a share of max health. */
  rest(healPercent) {
    this.activeEffects = [];
    this.abilities.forEach((ability) => ability.resetCooldown());
    return this.heal(Math.round(this.maxHealth * healPercent));
  }
}
