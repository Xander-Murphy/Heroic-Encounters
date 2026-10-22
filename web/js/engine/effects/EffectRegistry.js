import {
  ApplyStatusEffect, DamageEffect, DispelEffect, HealEffect, LifestealEffect,
} from './AbilityEffect.js';

/**
 * Maps the "type" key in a content definition to an AbilityEffect class.
 *
 * Adding a new kind of effect means writing a subclass and registering it
 * here; nothing that runs abilities has to change (Open/Closed).
 */
export class EffectRegistry {
  #types = new Map();

  register(EffectClass) {
    this.#types.set(EffectClass.type, EffectClass);
    return this;
  }

  has(type) {
    return this.#types.has(type);
  }

  types() {
    return [...this.#types.keys()];
  }

  create(definition, factory) {
    const EffectClass = this.#types.get(definition?.type);
    if (!EffectClass) throw new Error(`Unknown ability effect type: ${definition?.type}`);
    return EffectClass.fromDefinition(definition, factory);
  }
}

export const defaultEffectRegistry = new EffectRegistry()
  .register(DamageEffect)
  .register(HealEffect)
  .register(LifestealEffect)
  .register(ApplyStatusEffect)
  .register(DispelEffect);
