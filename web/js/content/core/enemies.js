import { ENEMY_ABILITIES as A, STATUS } from './abilities.js';

/**
 * Built-in enemies, grouped by the dungeon they appear in.
 * behavior: one of the BehaviorRegistry ids (random, aggressive, support, cunning).
 */
const enemy = (definition) => ({
  kind: 'enemy', rank: 'minion', enemyType: 'physical', behavior: 'random', resistances: {},
  basicAttackSchool: definition.enemyType === 'caster' ? 'shadow' : 'physical', phases: [], ...definition,
});

/* ----------------------------- Emberdeep Chasm ----------------------------- */
const EMBERDEEP = [
  enemy({ id: 'core:ashen_brute', name: 'Ashen Brute', portrait: '👹', health: 58, attack: 9, defense: 0, speed: 4, behavior: 'aggressive', abilities: [A.bruteSmash] }),
  enemy({ id: 'core:ember_shaman', name: 'Ember Shaman', portrait: '🧙', enemyType: 'caster', health: 48, attack: 10, defense: 0, speed: 5, behavior: 'support', resistances: { fire: 20 }, abilities: [A.lightningBolt, A.emberMend] }),
  enemy({ id: 'core:tunnel_borer', name: 'Tunnel Borer', portrait: '🪱', health: 64, attack: 12, defense: 2, speed: 5, abilities: [A.burrowStrike] }),
  enemy({ id: 'core:magma_elemental', name: 'Magma Elemental', portrait: '🌋', health: 68, attack: 10, defense: 2, speed: 4, resistances: { fire: 40, frost: -20 }, abilities: [A.moltenBlast] }),
  enemy({ id: 'core:flamebound_cultist', name: 'Flamebound Cultist', portrait: '🔥', health: 62, attack: 13, defense: 1, speed: 6, behavior: 'aggressive', abilities: [A.fanaticSlash] }),
  enemy({ id: 'core:flamebound_hexer', name: 'Flamebound Hexer', portrait: '🧿', enemyType: 'caster', health: 54, attack: 15, defense: 0, speed: 7, behavior: 'cunning', abilities: [A.burningHex] }),
  enemy({ id: 'core:flamebound_enforcer', name: 'Flamebound Enforcer', portrait: '⛓️', rank: 'elite', health: 76, attack: 11, defense: 3, speed: 5, behavior: 'cunning', abilities: [A.crushingBlow] }),
  enemy({
    id: 'core:kragmor', name: 'Kragmor the Ravenous', portrait: '🐗', rank: 'boss', health: 240, attack: 15, defense: 3, speed: 5, behavior: 'cunning',
    abilities: [A.cleave, A.devour],
    phases: [{ atHealthPercent: 50, message: 'Kragmor flies into a ravenous frenzy!', status: STATUS.frenzy }],
    lore: 'Ate his way to the bottom of the chasm and kept going.',
  }),
];

/* ----------------------------- Whispering Fens ----------------------------- */
const FENS = [
  enemy({ id: 'core:fen_ravager', name: 'Fen Ravager', portrait: '🐊', health: 60, attack: 11, defense: 1, speed: 5, behavior: 'aggressive', abilities: [A.rend] }),
  enemy({ id: 'core:mire_guardian', name: 'Mire Guardian', portrait: '🐢', health: 66, attack: 10, defense: 3, speed: 4, behavior: 'support', resistances: { nature: 20 }, abilities: [A.mireShield] }),
  enemy({ id: 'core:bog_viper', name: 'Bog Viper', portrait: '🐍', health: 56, attack: 13, defense: 2, speed: 6, behavior: 'cunning', resistances: { nature: 25 }, abilities: [A.venomBite] }),
  enemy({ id: 'core:moss_shambler', name: 'Moss Shambler', portrait: '🍄', health: 74, attack: 12, defense: 3, speed: 4, resistances: { fire: -20, nature: 30 }, abilities: [A.sporeBurst] }),
  enemy({ id: 'core:thornlasher', name: 'Thornlasher', portrait: '🌵', health: 52, attack: 11, defense: 0, speed: 6, behavior: 'aggressive', abilities: [A.lash] }),
  enemy({ id: 'core:serpent_mystic', name: 'Serpent Mystic', portrait: '🧝', enemyType: 'caster', rank: 'elite', health: 68, attack: 14, defense: 2, speed: 6, behavior: 'support', abilities: [A.lightningBolt, A.healingTouch] }),
  enemy({
    id: 'core:vexmaw', name: 'Vexmaw the Devourer', portrait: '🦂', rank: 'boss', health: 255, attack: 16, defense: 4, speed: 5, behavior: 'cunning',
    resistances: { nature: 30 },
    abilities: [A.toxicSpew, A.terrify],
    phases: [
      { atHealthPercent: 60, message: 'Vexmaw\'s carapace hardens!', status: STATUS.carapace },
      { atHealthPercent: 25, message: 'Vexmaw thrashes in a blind rage!', status: STATUS.rage },
    ],
    lore: 'The fens whisper because they are afraid of waking it.',
  }),
];

/* ---------------------------- Smuggler's Hollow ---------------------------- */
const HOLLOW = [
  enemy({ id: 'core:tunnel_miner', name: 'Tunnel Miner', portrait: '⛏️', health: 58, attack: 12, defense: 0, speed: 5, abilities: [A.pickSwing] }),
  enemy({ id: 'core:goblin_sapper', name: 'Goblin Sapper', portrait: '💣', health: 52, attack: 14, defense: 1, speed: 6, behavior: 'cunning', abilities: [A.blastCharge] }),
  enemy({ id: 'core:goblin_tinker', name: 'Goblin Tinker', portrait: '🔧', enemyType: 'caster', health: 56, attack: 14, defense: 2, speed: 5, behavior: 'support', abilities: [A.spark, A.patchUp] }),
  enemy({ id: 'core:hollow_blackguard', name: 'Hollow Blackguard', portrait: '🦹', rank: 'elite', health: 72, attack: 14, defense: 4, speed: 5, behavior: 'aggressive', abilities: [A.brutalStrike] }),
  enemy({ id: 'core:corsair_cutthroat', name: 'Corsair Cutthroat', portrait: '🏴‍☠️', health: 64, attack: 16, defense: 2, speed: 7, behavior: 'aggressive', abilities: [A.cutlassFlurry] }),
  enemy({ id: 'core:tide_witch', name: 'Tide Witch', portrait: '🌊', enemyType: 'caster', health: 58, attack: 17, defense: 1, speed: 7, behavior: 'cunning', resistances: { frost: 30 }, abilities: [A.frostBolt, A.tidalHex] }),
  enemy({ id: 'core:rogue_evoker', name: 'Rogue Evoker', portrait: '🧑‍🎤', enemyType: 'caster', health: 54, attack: 17, defense: 0, speed: 7, abilities: [A.fireball] }),
  enemy({
    id: 'core:silas_marr', name: 'Captain Silas Marr', portrait: '🦜', rank: 'boss', health: 285, attack: 18, defense: 4, speed: 6, behavior: 'cunning',
    abilities: [A.bladeStorm, A.markForDeath, A.smokeBomb],
    phases: [
      { atHealthPercent: 50, message: '"All hands!" Captain Marr steels his resolve.', status: STATUS.resolve },
      { atHealthPercent: 20, message: 'Captain Marr downs a bottle and makes a last stand!', status: STATUS.lastStand },
    ],
    lore: 'Runs the hollow like a ship, and every crew member is expendable but him.',
  }),
];

export const CORE_ENEMIES = Object.freeze([...EMBERDEEP, ...FENS, ...HOLLOW]);
