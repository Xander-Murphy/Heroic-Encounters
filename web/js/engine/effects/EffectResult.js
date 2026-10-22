/**
 * What happened when something was applied in combat.
 * Feeds the combat log, the animations and the run statistics.
 */
export class EffectResult {
  constructor({
    source = null,
    target,
    kind,
    description,
    amount = 0,
    school = null,
    defeated = false,
    ability = null,
  }) {
    this.source = source;
    this.target = target;
    this.kind = kind;
    this.description = description;
    this.amount = amount;
    this.school = school;
    this.defeated = defeated;
    this.ability = ability;
    Object.freeze(this);
  }
}
