/**
 * Built-in dungeons. Each wave picks min..max enemies from its pool;
 * the boss closes the dungeon. `scaling` raises enemy attack per wave.
 */
const dungeon = (definition) => ({ kind: 'dungeon', scaling: 0.1, restBetweenWaves: 0.25, ...definition });

export const CORE_DUNGEONS = Object.freeze([
  dungeon({
    id: 'core:emberdeep', name: 'Emberdeep Chasm', icon: '🌋', theme: 'ember', difficulty: 1,
    description: 'A cavern of smouldering rock where a fire cult feeds something enormous.',
    waves: [
      { enemies: ['core:ashen_brute', 'core:ember_shaman'], min: 2, max: 3 },
      { enemies: ['core:tunnel_borer', 'core:magma_elemental', 'core:ember_shaman'], min: 2, max: 3 },
      { enemies: ['core:flamebound_cultist', 'core:flamebound_hexer', 'core:flamebound_enforcer'], min: 2, max: 3 },
    ],
    boss: 'core:kragmor',
  }),
  dungeon({
    id: 'core:fens', name: 'Whispering Fens', icon: '🍄', theme: 'jade', difficulty: 2,
    description: 'Sunken marshland full of venom, spores and things that heal each other.',
    waves: [
      { enemies: ['core:fen_ravager', 'core:mire_guardian', 'core:fen_ravager'], min: 2, max: 3 },
      { enemies: ['core:bog_viper', 'core:moss_shambler', 'core:thornlasher'], min: 2, max: 3 },
      { enemies: ['core:serpent_mystic', 'core:moss_shambler', 'core:bog_viper'], min: 3, max: 3 },
    ],
    boss: 'core:vexmaw',
  }),
  dungeon({
    id: 'core:hollow', name: "Smuggler's Hollow", icon: '🏴‍☠️', theme: 'ocean', difficulty: 3, scaling: 0.12,
    description: 'Mines turned pirate den. The goblins build the bombs; the corsairs throw them.',
    waves: [
      { enemies: ['core:tunnel_miner', 'core:goblin_sapper'], min: 2, max: 3 },
      { enemies: ['core:goblin_sapper', 'core:goblin_tinker', 'core:tunnel_miner'], min: 3, max: 3 },
      { enemies: ['core:hollow_blackguard', 'core:corsair_cutthroat', 'core:tide_witch', 'core:rogue_evoker'], min: 3, max: 3 },
    ],
    boss: 'core:silas_marr',
  }),
]);
