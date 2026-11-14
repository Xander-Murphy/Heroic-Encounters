/**
 * Vocabulary shared by every layer of the game.
 *
 * Values are lowercase strings so they travel unchanged through JSON
 * (content definitions, share strings and the community API).
 */

const freeze = (object) => Object.freeze(object);

export const SpellSchool = freeze({
  PHYSICAL: 'physical',
  ARCANE: 'arcane',
  FIRE: 'fire',
  FROST: 'frost',
  HOLY: 'holy',
  NATURE: 'nature',
  SHADOW: 'shadow',
});

export const ALL_SCHOOLS = freeze(Object.values(SpellSchool));
export const MAGIC_SCHOOLS = freeze(ALL_SCHOOLS.filter((school) => school !== SpellSchool.PHYSICAL));
export const isMagicSchool = (school) => school !== SpellSchool.PHYSICAL;

export const EffectType = freeze({
  BUFF: 'buff',
  DEBUFF: 'debuff',
  DAMAGE_OVER_TIME: 'damage_over_time',
  HEAL_OVER_TIME: 'heal_over_time',
  IMMUNITY: 'immunity',
  STUN: 'stun',
  // The carrier must aim single-target attacks at whoever applied it. Cast on
  // one enemy it's a taunt; cast on all enemies it's an AoE taunt.
  TAUNT: 'taunt',
});

/** Effect types that hurt whoever carries them. */
export const HARMFUL_EFFECT_TYPES = freeze([
  EffectType.DEBUFF,
  EffectType.DAMAGE_OVER_TIME,
  EffectType.STUN,
  EffectType.TAUNT,
]);

export const EffectCategory = freeze({
  PHYSICAL: 'physical',
  MAGICAL: 'magical',
  CURSE: 'curse',
  DISEASE: 'disease',
  POISON: 'poison',
});

export const TargetType = freeze({
  SELF: 'self',
  SINGLE_ALLY: 'single_ally',
  ALL_ALLIES: 'all_allies',
  SINGLE_ENEMY: 'single_enemy',
  ALL_ENEMIES: 'all_enemies',
  // Death rattles only:
  EVERYONE: 'everyone', // both sides at once
  KILLER: 'killer', // whoever landed the killing blow
});

/**
 * Targets a death rattle may use. It fires automatically, so only targets
 * that need no choosing: groups, or the character's killer.
 */
export const DEATH_RATTLE_TARGETS = freeze([TargetType.ALL_ALLIES, TargetType.ALL_ENEMIES, TargetType.EVERYONE, TargetType.KILLER]);

/** Targets a normal (chosen each round) ability may use. */
export const ABILITY_TARGETS = freeze(Object.values(TargetType)
  .filter((target) => target !== TargetType.EVERYONE && target !== TargetType.KILLER));

export const isFriendlyTarget = (targetType) =>
  targetType === TargetType.SELF
  || targetType === TargetType.SINGLE_ALLY
  || targetType === TargetType.ALL_ALLIES;

export const Stat = freeze({
  ATTACK: 'attack',
  DEFENSE: 'defense',
  SPEED: 'speed',
  RESISTANCE: 'resistance',
});

export const Side = freeze({
  HERO: 'hero',
  ENEMY: 'enemy',
});

export const EnemyRank = freeze({
  MINION: 'minion',
  ELITE: 'elite',
  BOSS: 'boss',
});

/** What an EffectResult describes, so the UI knows how to animate it. */
export const ResultKind = freeze({
  DAMAGE: 'damage',
  HEAL: 'heal',
  STATUS: 'status',
  IMMUNE: 'immune',
  DISPEL: 'dispel',
  PHASE: 'phase',
  DEATH_RATTLE: 'death_rattle',
  REDIRECT: 'redirect', // a taunt changed who an action hits
  SKIP: 'skip',
});

export const SCHOOL_LABELS = freeze({
  physical: 'Physical', arcane: 'Arcane', fire: 'Fire', frost: 'Frost',
  holy: 'Holy', nature: 'Nature', shadow: 'Shadow',
});

export const TARGET_LABELS = freeze({
  self: 'Self', single_ally: 'One ally', all_allies: 'All allies',
  single_enemy: 'One enemy', all_enemies: 'All enemies', everyone: 'Everyone', killer: 'Its killer',
});

export const EFFECT_TYPE_LABELS = freeze({
  buff: 'Buff', debuff: 'Debuff', damage_over_time: 'Damage over time',
  heal_over_time: 'Heal over time', immunity: 'Immunity', stun: 'Stun', taunt: 'Taunt (must attack the caster)',
});
