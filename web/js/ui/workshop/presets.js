import { CLEANSE_ALL, STATUS } from '../../content/core/abilities.js';

/**
 * Starting points for new abilities, so creators get something that works
 * and then tweak it, rather than facing an empty form.
 */
const clone = (value) => structuredClone(value);
const ability = (name, fields) => ({ name, description: '', power: 0, cooldown: 2, target: 'single_enemy', school: 'physical', priority: 0, effects: [], ...fields });

export const ABILITY_PRESETS = Object.freeze([
  { id: 'strike', label: '⚔️ Single-target attack', build: () => ability('Strike', { power: 25, cooldown: 2, effects: [{ type: 'damage' }] }) },
  { id: 'aoe', label: '💥 Hit every enemy', build: () => ability('Shockwave', { power: 16, cooldown: 3, target: 'all_enemies', effects: [{ type: 'damage' }] }) },
  { id: 'heal', label: '💚 Heal one ally', build: () => ability('Mend', { power: 28, cooldown: 2, target: 'single_ally', school: 'holy', effects: [{ type: 'heal' }] }) },
  { id: 'group_heal', label: '💞 Heal every ally', build: () => ability('Renewal', { power: 14, cooldown: 3, target: 'all_allies', school: 'holy', effects: [{ type: 'heal' }] }) },
  { id: 'dot', label: '☠️ Damage over time', build: () => ability('Venom', { power: 12, cooldown: 3, school: 'nature', effects: [{ type: 'damage' }, { type: 'status', status: clone(STATUS.poison) }] }) },
  { id: 'buff', label: '😡 Buff yourself', build: () => ability('War Cry', { cooldown: 4, target: 'self', priority: 10, effects: [{ type: 'status', status: clone(STATUS.battleFury) }] }) },
  { id: 'team_buff', label: '🚩 Buff the party', build: () => ability('Rally', { cooldown: 4, target: 'all_allies', effects: [{ type: 'status', status: clone(STATUS.rally) }] }) },
  { id: 'debuff', label: '🔨 Weaken an enemy', build: () => ability('Sunder', { power: 15, cooldown: 3, effects: [{ type: 'damage' }, { type: 'status', status: clone(STATUS.armorBreak) }] }) },
  { id: 'stun', label: '💫 Stun an enemy', build: () => ability('Concuss', { power: 10, cooldown: 4, priority: 4, effects: [{ type: 'damage' }, { type: 'status', status: clone(STATUS.stun) }] }) },
  { id: 'immunity', label: '💨 Become immune', build: () => ability('Phase Out', { cooldown: 4, target: 'self', priority: 10, effects: [{ type: 'status', status: clone(STATUS.physicalImmunity) }] }) },
  { id: 'taunt', label: '📣 Taunt (protect allies)', build: () => ability('Provoke', { cooldown: 3, target: 'self', priority: 10, effects: [{ type: 'status', status: clone(STATUS.taunt) }, { type: 'status', status: clone(STATUS.guard) }] }) },
  { id: 'lifesteal', label: '🩸 Drain life', build: () => ability('Siphon', { power: 22, cooldown: 2, school: 'shadow', effects: [{ type: 'lifesteal', percent: 50 }] }) },
  { id: 'cleanse', label: '🫧 Cleanse allies', build: () => ability('Purify', { power: 8, cooldown: 3, target: 'all_allies', school: 'holy', effects: [clone(CLEANSE_ALL), { type: 'heal' }] }) },
]);

export const EFFECT_TYPE_OPTIONS = Object.freeze([
  { value: 'damage', label: 'Deal damage' },
  { value: 'heal', label: 'Heal' },
  { value: 'lifesteal', label: 'Damage + heal self' },
  { value: 'status', label: 'Apply status effect' },
  { value: 'dispel', label: 'Remove effects' },
]);

/** A fresh effect of a given type with sensible defaults. */
export function defaultEffect(type) {
  switch (type) {
    case 'status': return { type, status: clone(STATUS.armorBreak) };
    case 'dispel': return clone(CLEANSE_ALL);
    case 'lifesteal': return { type, percent: 50 };
    default: return { type };
  }
}

export const defaultPhaseStatus = () => clone(STATUS.frenzy);
