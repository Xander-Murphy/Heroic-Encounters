import { Ability } from '../engine/Ability.js';
import { defaultBehaviorRegistry } from '../engine/behaviors/BehaviorRegistry.js';
import { defaultEffectRegistry } from '../engine/effects/EffectRegistry.js';
import { Boss, Enemy } from '../engine/Enemy.js';
import { Hero } from '../engine/Hero.js';
import { StatusEffect } from '../engine/StatusEffect.js';
import { EnemyRank, TargetType } from '../engine/types.js';

const BASIC_ATTACK_POWER = 15;

/**
 * Turns validated content definitions (plain JSON) into engine objects
 * (Factory). The registries it uses are injected, so new effect types or
 * enemy behaviors plug in without touching this class (Dependency Inversion).
 */
export class ContentFactory {
  constructor({ effects = defaultEffectRegistry, behaviors = defaultBehaviorRegistry } = {}) {
    this.effects = effects;
    this.behaviors = behaviors;
  }

  createStatusEffect(definition) {
    return new StatusEffect(definition);
  }

  createAbility(definition) {
    return new Ability({
      ...definition,
      effects: definition.effects.map((effect) => this.effects.create(effect, this)),
    });
  }

  createBasicAttack(school = 'physical') {
    return this.createAbility({
      id: 'basic_attack',
      name: 'Basic Attack',
      description: `Deals ${school} damage to one enemy. Always available.`,
      power: BASIC_ATTACK_POWER,
      cooldown: 0,
      target: TargetType.SINGLE_ENEMY,
      school,
      effects: [{ type: 'damage' }],
    });
  }

  #characterFields(definition) {
    return {
      contentId: definition.id,
      name: definition.name,
      health: definition.health,
      attack: definition.attack,
      defense: definition.defense,
      speed: definition.speed,
      resistances: definition.resistances,
      abilities: definition.abilities.map((ability) => this.createAbility(ability)),
      basicAttack: this.createBasicAttack(definition.basicAttackSchool),
      portrait: definition.portrait,
      theme: definition.theme,
      lore: definition.lore,
    };
  }

  createHero(definition) {
    return new Hero({
      ...this.#characterFields(definition),
      className: definition.className,
      specialization: definition.specialization,
      role: definition.role,
    });
  }

  createEnemy(definition) {
    const fields = {
      ...this.#characterFields(definition),
      behavior: this.behaviors.get(definition.behavior),
      rank: definition.rank,
      enemyType: definition.enemyType,
    };
    if (definition.rank !== EnemyRank.BOSS) return new Enemy(fields);

    return new Boss({
      ...fields,
      phases: (definition.phases ?? []).map((phase) => ({
        atHealthPercent: phase.atHealthPercent,
        message: phase.message,
        status: phase.status ? this.createStatusEffect(phase.status) : null,
      })),
    });
  }

  /** Any character definition, by kind. */
  createCharacter(definition) {
    return definition.kind === 'hero' ? this.createHero(definition) : this.createEnemy(definition);
  }
}
