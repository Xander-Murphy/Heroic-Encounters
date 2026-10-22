import { HERO_ABILITIES as A } from './abilities.js';

/**
 * Built-in heroes. The first four are available from the start; the rest
 * unlock through progression (Business.md: "unlockable heroes").
 *
 * unlock: { type: 'default' } | { type: 'level', value } | { type: 'achievement', value: achievementId }
 */
const hero = (definition) => ({ kind: 'hero', role: 'damage', resistances: {}, basicAttackSchool: 'physical', unlock: { type: 'default' }, ...definition });

export const CORE_HEROES = Object.freeze([
  hero({
    id: 'core:koryne', name: 'Koryne', className: 'Mage', specialization: 'Arcane', portrait: '🔮', theme: 'arcane',
    health: 75, attack: 26, defense: 0, speed: 7, resistances: { arcane: 15 }, basicAttackSchool: 'arcane',
    abilities: [A.arcaneBlast, A.arcaneExplosion, A.manaWard],
    lore: 'A scholar of the deep weave who solves most problems by making them explode.',
  }),
  hero({
    id: 'core:genjo', name: 'Genjo', className: 'Rogue', specialization: 'Subtlety', portrait: '🗡️', theme: 'gold',
    health: 85, attack: 23, defense: 1, speed: 9,
    abilities: [A.backstab, A.evasion, A.shadowVeil],
    lore: 'Fast, quiet and almost impossible to pin down.',
  }),
  hero({
    id: 'core:scatter', name: 'Scatter', className: 'Ranger', specialization: 'Survival', portrait: '🏹', theme: 'forest',
    health: 95, attack: 21, defense: 2, speed: 7,
    abilities: [A.venomArrow, A.volley, A.steadyStance],
    lore: 'Tracker of the wild places, never without a quiver of nasty surprises.',
  }),
  hero({
    id: 'core:braeks', name: 'Braeks', className: 'Warrior', specialization: 'Fury', portrait: '🪓', theme: 'earth',
    health: 115, attack: 19, defense: 3, speed: 5,
    abilities: [A.mightyStrike, A.battleFury, A.whirlwind],
    lore: 'A wall of muscle who gets stronger the angrier he gets.',
  }),
  hero({
    id: 'core:elara', name: 'Elara', className: 'Cleric', specialization: 'Radiance', role: 'healer', portrait: '✨', theme: 'ivory',
    health: 80, attack: 14, defense: 1, speed: 6, basicAttackSchool: 'holy',
    abilities: [A.holyBolt, A.mendingLight, A.healingHymn],
    lore: 'Keeps the party standing long after it should have fallen.',
    unlock: { type: 'level', value: 2 },
  }),
  hero({
    id: 'core:thorne', name: 'Thorne', className: 'Guardian', specialization: 'Bulwark', role: 'tank', portrait: '🛡️', theme: 'steel',
    health: 135, attack: 14, defense: 5, speed: 4,
    abilities: [A.shieldBash, A.challenge, A.rally],
    lore: 'Plants a shield, dares the monsters to try, and means it.',
    unlock: { type: 'level', value: 3 },
  }),
  hero({
    id: 'core:brannoc', name: 'Brannoc', className: 'Wildheart', specialization: 'Grove', role: 'healer', portrait: '🌿', theme: 'jade',
    health: 90, attack: 17, defense: 2, speed: 6, basicAttackSchool: 'nature', resistances: { nature: 15 },
    abilities: [A.rejuvenate, A.entanglingRoots, A.thornBurst],
    lore: 'Speaks for the forest, and the forest has opinions.',
    unlock: { type: 'level', value: 4 },
  }),
  hero({
    id: 'core:morwen', name: 'Morwen', className: 'Hexer', specialization: 'Affliction', portrait: '🕯️', theme: 'violet',
    health: 80, attack: 22, defense: 0, speed: 6, basicAttackSchool: 'shadow', resistances: { shadow: 15 },
    abilities: [A.drainLife, A.creepingRot, A.curseOfFrailty],
    lore: 'Patient, polite, and quietly rotting everything in the room.',
    unlock: { type: 'level', value: 5 },
  }),
  hero({
    id: 'core:ysolde', name: 'Ysolde', className: 'Stormcaller', specialization: 'Tempest', role: 'support', portrait: '⚡', theme: 'ocean',
    health: 85, attack: 21, defense: 1, speed: 7, basicAttackSchool: 'nature',
    abilities: [A.chainLightning, A.frostShock, A.cleansingTide],
    lore: 'Calls the storm down on her enemies and the rain down on her friends.',
    unlock: { type: 'achievement', value: 'first_clear' },
  }),
]);
