import { defaultBehaviorRegistry } from '../engine/behaviors/BehaviorRegistry.js';
import { defaultEffectRegistry } from '../engine/effects/EffectRegistry.js';
import {
  ALL_SCHOOLS, EffectCategory, EffectType, EnemyRank, Stat, TargetType,
} from '../engine/types.js';

/**
 * Validation and normalization for content definitions.
 *
 * Every definition that enters the game — built-in, made in the workshop,
 * pasted from a share string or downloaded from the community server — goes
 * through here. A definition comes back as a *new* object containing only
 * known fields, so unexpected properties (or prototype tricks) never reach
 * the engine. The server uses this same module to check uploads.
 */

export const SCHEMA_VERSION = 1;

export const LIMITS = Object.freeze({
  idPattern: /^[a-z0-9][a-z0-9:_-]{2,63}$/i,
  name: 32,
  shortText: 24,
  description: 160,
  lore: 240,
  portrait: 16,
  health: [1, 500],
  bossHealth: [1, 999],
  attack: [0, 60],
  defense: [0, 20],
  speed: [1, 20],
  resistance: [-50, 75],
  abilities: [1, 4],
  power: [0, 80],
  cooldown: [0, 8],
  priority: [0, 10],
  effects: [1, 3],
  magnitude: [0, 40],
  duration: [1, 5],
  phaseDuration: [1, 99],
  lifesteal: [10, 100],
  phases: [0, 3],
  waves: [1, 6],
  wavePool: [1, 6],
  waveCount: [1, 4],
  scaling: [0, 0.3],
  rest: [0, 0.5],
  difficulty: [1, 5],
});

export const THEMES = Object.freeze([
  'arcane', 'gold', 'forest', 'earth', 'ivory', 'steel', 'jade', 'violet', 'ocean', 'ember', 'crimson', 'shadow', 'stone', 'rose',
]);

export const HERO_ROLES = Object.freeze(['damage', 'tank', 'healer', 'support']);
export const ENEMY_TYPES = Object.freeze(['physical', 'caster']);

const has = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Collects errors with a path, e.g. "abilities[1].effects[0].status.duration". */
class ValidationContext {
  constructor() {
    this.errors = [];
  }

  error(path, message) {
    this.errors.push(`${path}: ${message}`);
  }

  text(source, key, path, { max, required = true, fallback = '' }) {
    const value = source?.[key];
    if (value === undefined || value === null || value === '') {
      if (required) this.error(path, 'is required');
      return fallback;
    }
    if (typeof value !== 'string') {
      this.error(path, 'must be text');
      return fallback;
    }
    const trimmed = value.trim();
    if (required && !trimmed) this.error(path, 'is required');
    if (trimmed.length > max) this.error(path, `must be at most ${max} characters`);
    return trimmed.slice(0, max);
  }

  number(source, key, path, [min, max], { integer = true, fallback = min } = {}) {
    const value = has(source, key) ? source[key] : fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
      this.error(path, `must be ${integer ? 'a whole number' : 'a number'}`);
      return fallback;
    }
    if (value < min || value > max) this.error(path, `must be between ${min} and ${max}`);
    return Math.min(max, Math.max(min, value));
  }

  choice(source, key, path, options, { fallback, required = false } = {}) {
    const value = has(source, key) ? source[key] : undefined;
    if (value === undefined || value === null) {
      if (required) this.error(path, 'is required');
      return fallback;
    }
    if (!options.includes(value)) {
      this.error(path, `must be one of: ${options.join(', ')}`);
      return fallback;
    }
    return value;
  }

  list(source, key, path, [min, max]) {
    const value = source?.[key] ?? [];
    if (!Array.isArray(value)) {
      this.error(path, 'must be a list');
      return [];
    }
    if (value.length < min || value.length > max) this.error(path, `must have ${min} to ${max} entries`);
    return value.slice(0, max);
  }

  id(source, key, path, { required = true } = {}) {
    const value = source?.[key];
    if ((value === undefined || value === '') && !required) return '';
    if (typeof value !== 'string' || !LIMITS.idPattern.test(value)) {
      this.error(path, 'must be a valid id (letters, numbers, : _ -)');
      return '';
    }
    return value;
  }
}

/* ------------------------------ Validators ------------------------------ */

/** Base class: each content kind validates its own fields (polymorphism). */
class DefinitionValidator {
  /** @returns {object} normalized copy */
  normalize(_definition, _context) {
    throw new Error(`${this.constructor.name} must implement normalize()`);
  }
}

class StatusEffectValidator extends DefinitionValidator {
  constructor({ durationRange = LIMITS.duration } = {}) {
    super();
    this.durationRange = durationRange;
  }

  normalize(definition, context, path = 'status') {
    if (!isPlainObject(definition)) {
      context.error(path, 'must be a status effect');
      return null;
    }
    const type = context.choice(definition, 'type', `${path}.type`, Object.values(EffectType), { required: true, fallback: EffectType.BUFF });
    const value = {
      name: context.text(definition, 'name', `${path}.name`, { max: LIMITS.name }),
      icon: context.text(definition, 'icon', `${path}.icon`, { max: LIMITS.portrait, required: false, fallback: '✨' }),
      type,
      category: context.choice(definition, 'category', `${path}.category`, Object.values(EffectCategory), { fallback: EffectCategory.MAGICAL }),
      magnitude: context.number(definition, 'magnitude', `${path}.magnitude`, LIMITS.magnitude, { fallback: 0 }),
      duration: context.number(definition, 'duration', `${path}.duration`, this.durationRange, { fallback: 1 }),
      schools: context.list(definition, 'schools', `${path}.schools`, [0, ALL_SCHOOLS.length])
        .filter((school, index) => {
          if (ALL_SCHOOLS.includes(school)) return true;
          context.error(`${path}.schools[${index}]`, 'is not a damage school');
          return false;
        }),
      stat: null,
      tickSchool: null,
      description: context.text(definition, 'description', `${path}.description`, { max: LIMITS.description, required: false }),
    };

    if (type === EffectType.BUFF || type === EffectType.DEBUFF) {
      value.stat = context.choice(definition, 'stat', `${path}.stat`, Object.values(Stat), { required: true, fallback: Stat.ATTACK });
      if (value.stat === Stat.RESISTANCE && value.schools.length === 0) context.error(`${path}.schools`, 'resistance effects need at least one school');
    }
    if (type === EffectType.DAMAGE_OVER_TIME) {
      value.tickSchool = context.choice(definition, 'tickSchool', `${path}.tickSchool`, ALL_SCHOOLS, { fallback: 'physical' });
    }
    if (type === EffectType.IMMUNITY && value.schools.length === 0) context.error(`${path}.schools`, 'immunity needs at least one school');
    return value;
  }
}

class EffectValidator extends DefinitionValidator {
  constructor(statusValidator) {
    super();
    this.statusValidator = statusValidator;
  }

  normalize(definition, context, path) {
    if (!isPlainObject(definition) || !defaultEffectRegistry.has(definition.type)) {
      context.error(`${path}.type`, `must be one of: ${defaultEffectRegistry.types().join(', ')}`);
      return null;
    }
    switch (definition.type) {
      case 'status':
        return { type: 'status', status: this.statusValidator.normalize(definition.status, context, `${path}.status`) };
      case 'dispel':
        return {
          type: 'dispel',
          harmful: definition.harmful !== false,
          categories: context.list(definition, 'categories', `${path}.categories`, [1, 5])
            .filter((category) => Object.values(EffectCategory).includes(category)),
        };
      case 'lifesteal':
        return { type: 'lifesteal', percent: context.number(definition, 'percent', `${path}.percent`, LIMITS.lifesteal, { fallback: 50 }) };
      default:
        return { type: definition.type };
    }
  }
}

class AbilityValidator extends DefinitionValidator {
  constructor(effectValidator) {
    super();
    this.effectValidator = effectValidator;
  }

  normalize(definition, context, path) {
    if (!isPlainObject(definition)) {
      context.error(path, 'must be an ability');
      return null;
    }
    const value = {
      id: context.id(definition, 'id', `${path}.id`, { required: false }),
      name: context.text(definition, 'name', `${path}.name`, { max: LIMITS.name }),
      description: context.text(definition, 'description', `${path}.description`, { max: LIMITS.description, required: false }),
      power: context.number(definition, 'power', `${path}.power`, LIMITS.power, { fallback: 0 }),
      cooldown: context.number(definition, 'cooldown', `${path}.cooldown`, LIMITS.cooldown, { fallback: 0 }),
      target: context.choice(definition, 'target', `${path}.target`, Object.values(TargetType), { required: true, fallback: TargetType.SINGLE_ENEMY }),
      school: context.choice(definition, 'school', `${path}.school`, ALL_SCHOOLS, { fallback: 'physical' }),
      priority: context.number(definition, 'priority', `${path}.priority`, LIMITS.priority, { fallback: 0 }),
      animation: context.choice(definition, 'animation', `${path}.animation`, ['lunge', 'projectile', 'arrow', 'burst', 'spin'], { fallback: null }),
      effects: context.list(definition, 'effects', `${path}.effects`, LIMITS.effects)
        .map((effect, index) => this.effectValidator.normalize(effect, context, `${path}.effects[${index}]`))
        .filter(Boolean),
    };
    const dealsDamage = value.effects.some((effect) => effect.type === 'damage' || effect.type === 'lifesteal' || effect.type === 'heal');
    if (dealsDamage && value.power === 0) context.error(`${path}.power`, 'damage and healing need power above 0');
    return value;
  }
}

/** Shared fields for heroes and enemies (Inheritance mirrors the engine's Character). */
class CharacterValidator extends DefinitionValidator {
  constructor(abilityValidator) {
    super();
    this.abilityValidator = abilityValidator;
  }

  healthRange() {
    return LIMITS.health;
  }

  normalize(definition, context) {
    const resistances = {};
    if (definition.resistances !== undefined && !isPlainObject(definition.resistances)) {
      context.error('resistances', 'must map schools to percentages');
    }
    for (const school of ALL_SCHOOLS) {
      if (has(definition.resistances, school)) {
        resistances[school] = context.number(definition.resistances, school, `resistances.${school}`, LIMITS.resistance, { fallback: 0 });
      }
    }
    return {
      id: context.id(definition, 'id', 'id'),
      kind: definition.kind,
      name: context.text(definition, 'name', 'name', { max: LIMITS.name }),
      portrait: context.text(definition, 'portrait', 'portrait', { max: LIMITS.portrait, required: false, fallback: '❔' }),
      theme: context.choice(definition, 'theme', 'theme', THEMES, { fallback: null }),
      lore: context.text(definition, 'lore', 'lore', { max: LIMITS.lore, required: false }),
      author: context.text(definition, 'author', 'author', { max: LIMITS.name, required: false }),
      health: context.number(definition, 'health', 'health', this.healthRange(definition)),
      attack: context.number(definition, 'attack', 'attack', LIMITS.attack),
      defense: context.number(definition, 'defense', 'defense', LIMITS.defense, { fallback: 0 }),
      speed: context.number(definition, 'speed', 'speed', LIMITS.speed, { fallback: 5 }),
      resistances,
      basicAttackSchool: context.choice(definition, 'basicAttackSchool', 'basicAttackSchool', ALL_SCHOOLS, { fallback: 'physical' }),
      abilities: context.list(definition, 'abilities', 'abilities', LIMITS.abilities)
        .map((ability, index) => this.abilityValidator.normalize(ability, context, `abilities[${index}]`))
        .filter(Boolean),
    };
  }
}

class HeroValidator extends CharacterValidator {
  normalize(definition, context) {
    const value = super.normalize(definition, context);
    value.className = context.text(definition, 'className', 'className', { max: LIMITS.shortText });
    value.specialization = context.text(definition, 'specialization', 'specialization', { max: LIMITS.shortText, required: false });
    value.role = context.choice(definition, 'role', 'role', HERO_ROLES, { fallback: 'damage' });
    if (isPlainObject(definition.unlock)) {
      const type = context.choice(definition.unlock, 'type', 'unlock.type', ['default', 'level', 'achievement'], { fallback: 'default' });
      value.unlock = type === 'default' ? { type } : { type, value: definition.unlock.value };
    }
    return value;
  }
}

class EnemyValidator extends CharacterValidator {
  constructor(abilityValidator, phaseStatusValidator) {
    super(abilityValidator);
    this.phaseStatusValidator = phaseStatusValidator;
  }

  healthRange(definition) {
    return definition.rank === EnemyRank.BOSS ? LIMITS.bossHealth : LIMITS.health;
  }

  normalize(definition, context) {
    const value = super.normalize(definition, context);
    value.rank = context.choice(definition, 'rank', 'rank', Object.values(EnemyRank), { fallback: EnemyRank.MINION });
    value.enemyType = context.choice(definition, 'enemyType', 'enemyType', ENEMY_TYPES, { fallback: 'physical' });
    value.behavior = context.choice(definition, 'behavior', 'behavior', defaultBehaviorRegistry.options().map((option) => option.id), { fallback: 'random' });
    value.phases = value.rank !== EnemyRank.BOSS ? [] : context.list(definition, 'phases', 'phases', LIMITS.phases)
      .map((phase, index) => {
        const path = `phases[${index}]`;
        if (!isPlainObject(phase)) {
          context.error(path, 'must be a phase');
          return null;
        }
        return {
          atHealthPercent: context.number(phase, 'atHealthPercent', `${path}.atHealthPercent`, [1, 99], { fallback: 50 }),
          message: context.text(phase, 'message', `${path}.message`, { max: LIMITS.description, required: false }),
          status: phase.status ? this.phaseStatusValidator.normalize(phase.status, context, `${path}.status`) : null,
        };
      })
      .filter(Boolean);
    return value;
  }
}

class DungeonValidator extends DefinitionValidator {
  normalize(definition, context) {
    return {
      id: context.id(definition, 'id', 'id'),
      kind: 'dungeon',
      name: context.text(definition, 'name', 'name', { max: LIMITS.name }),
      description: context.text(definition, 'description', 'description', { max: LIMITS.description, required: false }),
      icon: context.text(definition, 'icon', 'icon', { max: LIMITS.portrait, required: false, fallback: '🏰' }),
      theme: context.choice(definition, 'theme', 'theme', THEMES, { fallback: 'stone' }),
      author: context.text(definition, 'author', 'author', { max: LIMITS.name, required: false }),
      difficulty: context.number(definition, 'difficulty', 'difficulty', LIMITS.difficulty, { fallback: 1 }),
      scaling: context.number(definition, 'scaling', 'scaling', LIMITS.scaling, { integer: false, fallback: 0.1 }),
      restBetweenWaves: context.number(definition, 'restBetweenWaves', 'restBetweenWaves', LIMITS.rest, { integer: false, fallback: 0.25 }),
      waves: context.list(definition, 'waves', 'waves', LIMITS.waves).map((wave, index) => {
        const path = `waves[${index}]`;
        const min = context.number(wave, 'min', `${path}.min`, LIMITS.waveCount, { fallback: 1 });
        const max = context.number(wave, 'max', `${path}.max`, LIMITS.waveCount, { fallback: min });
        if (max < min) context.error(`${path}.max`, 'must be at least min');
        return {
          enemies: context.list(wave, 'enemies', `${path}.enemies`, LIMITS.wavePool)
            .map((id, enemyIndex) => context.id({ id }, 'id', `${path}.enemies[${enemyIndex}]`)),
          min,
          max: Math.max(min, max),
        };
      }),
      boss: context.id(definition, 'boss', 'boss'),
    };
  }
}

/* -------------------------------- Facade -------------------------------- */

const statusValidator = new StatusEffectValidator();
const abilityValidator = new AbilityValidator(new EffectValidator(statusValidator));
const phaseStatusValidator = new StatusEffectValidator({ durationRange: LIMITS.phaseDuration });

const VALIDATORS = Object.freeze({
  hero: new HeroValidator(abilityValidator),
  enemy: new EnemyValidator(abilityValidator, phaseStatusValidator),
  dungeon: new DungeonValidator(),
});

export const CONTENT_KINDS = Object.freeze(Object.keys(VALIDATORS));

/**
 * Validate one definition.
 * @returns {{ valid: boolean, errors: string[], value: object | null }}
 */
export function validateDefinition(definition) {
  const context = new ValidationContext();
  if (!isPlainObject(definition)) return { valid: false, errors: ['definition must be an object'], value: null };

  const validator = VALIDATORS[definition.kind];
  if (!validator) return { valid: false, errors: [`kind must be one of: ${CONTENT_KINDS.join(', ')}`], value: null };

  const value = validator.normalize(definition, context);
  return { valid: context.errors.length === 0, errors: context.errors, value };
}
