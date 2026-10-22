/**
 * Built-in ability definitions (plain JSON-shaped data).
 *
 * Status effects are written inline so every ability — built-in or
 * player-made — is self-contained and can travel inside a share string.
 */

const status = (definition) => ({ category: 'magical', magnitude: 0, duration: 1, schools: [], ...definition });

export const STATUS = Object.freeze({
  arcaneVulnerability: status({ name: 'Arcane Vulnerability', icon: '🌀', type: 'debuff', category: 'magical', magnitude: 15, duration: 2, schools: ['arcane'], stat: 'resistance' }),
  manaWard: status({ name: 'Mana Ward', icon: '🔷', type: 'buff', category: 'magical', magnitude: 20, duration: 2, schools: ['physical', 'arcane', 'fire', 'frost', 'holy', 'nature', 'shadow'], stat: 'resistance' }),
  physicalImmunity: status({ name: 'Evasion', icon: '💨', type: 'immunity', category: 'physical', duration: 1, schools: ['physical'] }),
  magicalImmunity: status({ name: 'Shadow Veil', icon: '🌑', type: 'immunity', category: 'magical', duration: 1, schools: ['arcane', 'fire', 'frost', 'holy', 'nature', 'shadow'] }),
  poison: status({ name: 'Poison', icon: '☠️', type: 'damage_over_time', category: 'poison', magnitude: 9, duration: 3, tickSchool: 'nature' }),
  steadyStance: status({ name: 'Steady Stance', icon: '🛡️', type: 'buff', category: 'physical', magnitude: 7, duration: 2, stat: 'defense' }),
  armorBreak: status({ name: 'Armor Break', icon: '🔨', type: 'debuff', category: 'physical', magnitude: 4, duration: 2, stat: 'defense' }),
  battleFury: status({ name: 'Battle Fury', icon: '😡', type: 'buff', category: 'physical', magnitude: 12, duration: 3, stat: 'attack' }),
  stun: status({ name: 'Stunned', icon: '💫', type: 'stun', category: 'physical', duration: 1 }),
  taunt: status({ name: 'Challenged', icon: '📣', type: 'taunt', category: 'physical', duration: 2 }),
  guard: status({ name: 'Guarded', icon: '🧱', type: 'buff', category: 'physical', magnitude: 4, duration: 2, stat: 'defense' }),
  rally: status({ name: 'Rallied', icon: '🚩', type: 'buff', category: 'physical', magnitude: 4, duration: 2, stat: 'defense' }),
  rejuvenation: status({ name: 'Rejuvenation', icon: '🌱', type: 'heal_over_time', category: 'magical', magnitude: 12, duration: 3 }),
  rooted: status({ name: 'Rooted', icon: '🌿', type: 'debuff', category: 'magical', magnitude: 4, duration: 2, stat: 'speed' }),
  creepingRot: status({ name: 'Creeping Rot', icon: '🦠', type: 'damage_over_time', category: 'disease', magnitude: 8, duration: 3, tickSchool: 'shadow' }),
  frailty: status({ name: 'Curse of Frailty', icon: '🕯️', type: 'debuff', category: 'curse', magnitude: 5, duration: 3, stat: 'defense' }),
  chilled: status({ name: 'Chilled', icon: '❄️', type: 'debuff', category: 'magical', magnitude: 3, duration: 2, stat: 'speed' }),
  bleed: status({ name: 'Bleeding', icon: '🩸', type: 'damage_over_time', category: 'physical', magnitude: 6, duration: 2, tickSchool: 'physical' }),
  burningHex: status({ name: 'Burning Hex', icon: '🔥', type: 'damage_over_time', category: 'curse', magnitude: 6, duration: 3, tickSchool: 'fire' }),
  mireShield: status({ name: 'Mire Shield', icon: '🪨', type: 'buff', category: 'magical', magnitude: 3, duration: 2, stat: 'defense' }),
  smokeBomb: status({ name: 'Smoke Bomb', icon: '💨', type: 'immunity', category: 'physical', duration: 1, schools: ['physical'] }),
  marked: status({ name: 'Marked for Death', icon: '🎯', type: 'debuff', category: 'physical', magnitude: 6, duration: 2, stat: 'defense' }),
  frenzy: status({ name: 'Ravenous Frenzy', icon: '🩸', type: 'buff', category: 'physical', magnitude: 8, duration: 99, stat: 'attack' }),
  carapace: status({ name: 'Hardened Carapace', icon: '🐚', type: 'buff', category: 'physical', magnitude: 6, duration: 99, stat: 'defense' }),
  rage: status({ name: 'Blind Rage', icon: '👹', type: 'buff', category: 'physical', magnitude: 10, duration: 99, stat: 'attack' }),
  resolve: status({ name: "Captain's Resolve", icon: '⚓', type: 'buff', category: 'physical', magnitude: 8, duration: 99, stat: 'attack' }),
  lastStand: status({ name: 'Last Stand', icon: '🍺', type: 'heal_over_time', category: 'physical', magnitude: 15, duration: 3 }),
});

const ability = (definition) => ({ description: '', power: 0, cooldown: 0, target: 'single_enemy', school: 'physical', priority: 0, effects: [], ...definition });
const damage = { type: 'damage' };
const heal = { type: 'heal' };
const applies = (statusDefinition) => ({ type: 'status', status: statusDefinition });

export const CLEANSE_ALL = { type: 'dispel', categories: ['magical', 'curse', 'disease', 'poison'], harmful: true };

/* ---------------------------- Hero abilities ---------------------------- */

export const HERO_ABILITIES = Object.freeze({
  // Koryne — Mage / Arcane
  arcaneBlast: ability({ id: 'arcane_blast', name: 'Arcane Blast', description: 'Arcane damage that leaves the target vulnerable to more arcane magic.', power: 30, cooldown: 2, school: 'arcane', effects: [damage, applies(STATUS.arcaneVulnerability)] }),
  arcaneExplosion: ability({ id: 'arcane_explosion', name: 'Arcane Explosion', description: 'Arcane damage to every enemy.', power: 20, cooldown: 3, target: 'all_enemies', school: 'arcane', effects: [damage], animation: 'burst' }),
  manaWard: ability({ id: 'mana_ward', name: 'Mana Ward', description: '+20% resistance to every school for 2 rounds.', cooldown: 3, target: 'self', school: 'arcane', effects: [applies(STATUS.manaWard)] }),

  // Genjo — Rogue / Subtlety
  backstab: ability({ id: 'backstab', name: 'Backstab', description: 'Heavy physical damage to one enemy.', power: 28, cooldown: 2, effects: [damage] }),
  evasion: ability({ id: 'evasion', name: 'Evasion', description: 'Immune to physical damage this round. Acts first.', cooldown: 4, target: 'self', priority: 10, effects: [applies(STATUS.physicalImmunity)] }),
  shadowVeil: ability({ id: 'shadow_veil', name: 'Shadow Veil', description: 'Immune to magic this round and shrug off harmful magic. Acts first.', cooldown: 4, target: 'self', school: 'shadow', priority: 10, effects: [applies(STATUS.magicalImmunity), CLEANSE_ALL] }),

  // Scatter — Ranger / Survival
  venomArrow: ability({ id: 'venom_arrow', name: 'Venom Arrow', description: 'Physical damage plus poison for 3 rounds.', power: 20, cooldown: 3, effects: [damage, applies(STATUS.poison)], animation: 'arrow' }),
  volley: ability({ id: 'volley', name: 'Volley', description: 'Physical damage to every enemy.', power: 16, cooldown: 3, target: 'all_enemies', effects: [damage], animation: 'arrow' }),
  steadyStance: ability({ id: 'steady_stance', name: 'Steady Stance', description: '+7 defense for 2 rounds.', cooldown: 3, target: 'self', effects: [applies(STATUS.steadyStance)] }),

  // Braeks — Warrior / Fury
  mightyStrike: ability({ id: 'mighty_strike', name: 'Mighty Strike', description: 'Physical damage that cracks the target\'s armor.', power: 25, cooldown: 2, effects: [damage, applies(STATUS.armorBreak)] }),
  battleFury: ability({ id: 'battle_fury', name: 'Battle Fury', description: '+12 attack for 3 rounds. Acts first.', cooldown: 4, target: 'self', priority: 10, effects: [applies(STATUS.battleFury)] }),
  whirlwind: ability({ id: 'whirlwind', name: 'Whirlwind', description: 'Physical damage to every enemy.', power: 16, cooldown: 3, target: 'all_enemies', effects: [damage], animation: 'spin' }),

  // Elara — Cleric / Holy
  holyBolt: ability({ id: 'holy_bolt', name: 'Holy Bolt', description: 'Holy damage to one enemy.', power: 20, cooldown: 1, school: 'holy', effects: [damage] }),
  mendingLight: ability({ id: 'mending_light', name: 'Mending Light', description: 'Heal one ally.', power: 32, cooldown: 2, target: 'single_ally', school: 'holy', effects: [heal] }),
  healingHymn: ability({ id: 'healing_hymn', name: 'Healing Hymn', description: 'Heal every ally.', power: 16, cooldown: 3, target: 'all_allies', school: 'holy', effects: [heal], animation: 'burst' }),

  // Thorne — Guardian / Bulwark
  shieldBash: ability({ id: 'shield_bash', name: 'Shield Bash', description: 'Physical damage that stuns. Fast enough to interrupt.', power: 16, cooldown: 3, priority: 4, effects: [damage, applies(STATUS.stun)] }),
  challenge: ability({ id: 'challenge', name: 'Challenge', description: 'Enemies must target Thorne for 2 rounds. +4 defense.', cooldown: 3, target: 'self', priority: 10, effects: [applies(STATUS.taunt), applies(STATUS.guard)] }),
  rally: ability({ id: 'rally', name: 'Rally', description: '+4 defense to every ally for 2 rounds.', cooldown: 4, target: 'all_allies', effects: [applies(STATUS.rally)], animation: 'burst' }),

  // Brannoc — Wildheart / Grove
  rejuvenate: ability({ id: 'rejuvenate', name: 'Rejuvenate', description: 'Heal one ally 12 per round for 3 rounds.', cooldown: 2, target: 'single_ally', school: 'nature', effects: [applies(STATUS.rejuvenation)] }),
  entanglingRoots: ability({ id: 'entangling_roots', name: 'Entangling Roots', description: 'Nature damage and -4 speed for 2 rounds.', power: 18, cooldown: 2, school: 'nature', effects: [damage, applies(STATUS.rooted)] }),
  thornBurst: ability({ id: 'thorn_burst', name: 'Thorn Burst', description: 'Nature damage to every enemy.', power: 17, cooldown: 3, target: 'all_enemies', school: 'nature', effects: [damage], animation: 'burst' }),

  // Morwen — Hexer / Affliction
  drainLife: ability({ id: 'drain_life', name: 'Drain Life', description: 'Shadow damage; Morwen heals for half of it.', power: 24, cooldown: 2, school: 'shadow', effects: [{ type: 'lifesteal', percent: 50 }] }),
  creepingRot: ability({ id: 'creeping_rot', name: 'Creeping Rot', description: 'Every enemy takes 8 shadow damage per round for 3 rounds.', cooldown: 3, target: 'all_enemies', school: 'shadow', effects: [applies(STATUS.creepingRot)], animation: 'burst' }),
  curseOfFrailty: ability({ id: 'curse_of_frailty', name: 'Curse of Frailty', description: 'Shadow damage and -5 defense for 3 rounds.', power: 14, cooldown: 3, school: 'shadow', effects: [damage, applies(STATUS.frailty)] }),

  // Ysolde — Stormcaller / Tempest
  chainLightning: ability({ id: 'chain_lightning', name: 'Chain Lightning', description: 'Nature damage to every enemy.', power: 20, cooldown: 3, target: 'all_enemies', school: 'nature', effects: [damage] }),
  frostShock: ability({ id: 'frost_shock', name: 'Frost Shock', description: 'Frost damage and -3 speed for 2 rounds.', power: 24, cooldown: 2, school: 'frost', effects: [damage, applies(STATUS.chilled)] }),
  cleansingTide: ability({ id: 'cleansing_tide', name: 'Cleansing Tide', description: 'Heal every ally a little and wash away harmful magic, curses, disease and poison.', power: 10, cooldown: 3, target: 'all_allies', school: 'nature', effects: [CLEANSE_ALL, heal], animation: 'burst' }),
});

/* ---------------------------- Enemy abilities --------------------------- */

export const ENEMY_ABILITIES = Object.freeze({
  bruteSmash: ability({ id: 'brute_smash', name: 'Brute Smash', power: 20, cooldown: 1, effects: [damage] }),
  lightningBolt: ability({ id: 'lightning_bolt', name: 'Lightning Bolt', power: 22, cooldown: 1, school: 'nature', effects: [damage] }),
  emberMend: ability({ id: 'ember_mend', name: 'Ember Mend', power: 18, cooldown: 3, target: 'single_ally', school: 'fire', effects: [heal] }),
  burrowStrike: ability({ id: 'burrow_strike', name: 'Burrow Strike', power: 25, cooldown: 2, effects: [damage] }),
  moltenBlast: ability({ id: 'molten_blast', name: 'Molten Blast', power: 28, cooldown: 2, school: 'fire', effects: [damage] }),
  fanaticSlash: ability({ id: 'fanatic_slash', name: 'Fanatic Slash', power: 20, cooldown: 1, effects: [damage] }),
  burningHex: ability({ id: 'burning_hex', name: 'Burning Hex', power: 14, cooldown: 2, school: 'fire', effects: [damage, applies(STATUS.burningHex)] }),
  crushingBlow: ability({ id: 'crushing_blow', name: 'Crushing Blow', power: 22, cooldown: 3, effects: [damage, applies(STATUS.armorBreak)] }),
  cleave: ability({ id: 'cleave', name: 'Cleave', power: 16, cooldown: 2, target: 'all_enemies', effects: [damage], animation: 'spin' }),
  devour: ability({ id: 'devour', name: 'Devour', power: 28, cooldown: 3, effects: [{ type: 'lifesteal', percent: 60 }] }),

  rend: ability({ id: 'rend', name: 'Rend', power: 15, cooldown: 2, effects: [damage, applies(STATUS.bleed)] }),
  mireShield: ability({ id: 'mire_shield', name: 'Mire Shield', cooldown: 3, target: 'all_allies', school: 'nature', effects: [applies(STATUS.mireShield)] }),
  venomBite: ability({ id: 'venom_bite', name: 'Venom Bite', power: 15, cooldown: 2, school: 'nature', effects: [damage, applies(STATUS.poison)] }),
  sporeBurst: ability({ id: 'spore_burst', name: 'Spore Burst', power: 13, cooldown: 3, target: 'all_enemies', school: 'nature', effects: [damage], animation: 'burst' }),
  lash: ability({ id: 'lash', name: 'Lash', power: 18, cooldown: 1, effects: [damage] }),
  healingTouch: ability({ id: 'healing_touch', name: 'Healing Touch', power: 22, cooldown: 2, target: 'single_ally', school: 'nature', effects: [heal] }),
  toxicSpew: ability({ id: 'toxic_spew', name: 'Toxic Spew', power: 14, cooldown: 2, target: 'all_enemies', school: 'nature', effects: [damage, applies({ ...STATUS.poison, magnitude: 6, duration: 2 })], animation: 'burst' }),
  terrify: ability({ id: 'terrify', name: 'Terrifying Roar', cooldown: 4, priority: 5, school: 'shadow', effects: [applies(STATUS.stun)] }),

  pickSwing: ability({ id: 'pick_swing', name: 'Pick Swing', power: 18, cooldown: 1, effects: [damage] }),
  blastCharge: ability({ id: 'blast_charge', name: 'Blast Charge', power: 15, cooldown: 3, target: 'all_enemies', school: 'fire', effects: [damage], animation: 'burst' }),
  patchUp: ability({ id: 'patch_up', name: 'Patch Up', power: 20, cooldown: 2, target: 'single_ally', effects: [heal] }),
  spark: ability({ id: 'spark', name: 'Spark', power: 18, cooldown: 1, school: 'arcane', effects: [damage] }),
  brutalStrike: ability({ id: 'brutal_strike', name: 'Brutal Strike', power: 24, cooldown: 2, effects: [damage] }),
  cutlassFlurry: ability({ id: 'cutlass_flurry', name: 'Cutlass Flurry', power: 20, cooldown: 2, effects: [damage, applies(STATUS.bleed)] }),
  frostBolt: ability({ id: 'frost_bolt', name: 'Frost Bolt', power: 22, cooldown: 2, school: 'frost', effects: [damage, applies(STATUS.chilled)] }),
  tidalHex: ability({ id: 'tidal_hex', name: 'Tidal Hex', cooldown: 5, priority: 3, school: 'frost', effects: [applies(STATUS.stun)] }),
  fireball: ability({ id: 'fireball', name: 'Fireball', power: 26, cooldown: 2, school: 'fire', effects: [damage] }),
  bladeStorm: ability({ id: 'blade_storm', name: 'Blade Storm', power: 18, cooldown: 2, target: 'all_enemies', effects: [damage], animation: 'spin' }),
  markForDeath: ability({ id: 'mark_for_death', name: 'Mark for Death', power: 26, cooldown: 3, effects: [damage, applies(STATUS.marked)] }),
  smokeBomb: ability({ id: 'smoke_bomb', name: 'Smoke Bomb', cooldown: 4, target: 'self', priority: 10, effects: [applies(STATUS.smokeBomb)] }),
});
