import { EffectType, SCHOOL_LABELS, Stat, TARGET_LABELS } from '../../engine/types.js';
import { h, plural } from '../dom.js';
import { themeFor } from '../themes.js';
import { attachTooltip } from './Tooltip.js';

/**
 * Trading-card view of a hero or enemy (engine Character).
 * Speed gem top-left, defense shield top-right, attack bottom-left, health
 * bottom-right; abilities on the parchment; class/type banner at the bottom.
 */

const KIND_LABEL = {
  [EffectType.BUFF]: 'Buff', [EffectType.DEBUFF]: 'Debuff', [EffectType.DAMAGE_OVER_TIME]: 'Damage over time',
  [EffectType.HEAL_OVER_TIME]: 'Heal over time', [EffectType.IMMUNITY]: 'Immunity', [EffectType.STUN]: 'Stun', [EffectType.TAUNT]: 'Taunt',
};

export function abilityDetails(ability) {
  const parts = [TARGET_LABELS[ability.target], SCHOOL_LABELS[ability.school]];
  if (ability.cooldown) parts.push(`cooldown ${ability.cooldown}`);
  if (ability.priority) parts.push(`+${ability.priority} speed`);
  return parts.join(' · ');
}

function tooltipContent(character) {
  const effects = character.activeEffects.map((effect) => h('div', { class: ['tip-effect', effect.isHarmful && 'debuff'] },
    h('b', {}, `${effect.icon} ${effect.name}`), ' ',
    h('i', {}, `${KIND_LABEL[effect.type]} · ${plural(effect.remainingDuration, 'round')} left`),
    h('br'), effect.describe()));

  const resistances = Object.entries(character.resistances).filter(([, value]) => value)
    .map(([school, value]) => h('div', {}, `${SCHOOL_LABELS[school]}: ${value > 0 ? `${value}% less` : `${-value}% more`} damage taken`));

  const abilities = character.allAbilities().map((ability) => h('div', { class: 'tip-ability' },
    h('b', {}, ability.name), h('span', { class: 'tip-meta' }, ` ${abilityDetails(ability)}`),
    h('div', {}, ability.description || ability.summary())));

  return h('div', {},
    h('div', { class: 'tip-title' }, `${character.portrait} ${character.name}`),
    h('div', { class: 'tip-sub' }, `${character.typeLine} · HP ${character.health}/${character.maxHealth}`),
    character.lore ? h('div', { class: 'tip-lore' }, character.lore) : null,
    h('div', { class: 'tip-section' }, 'Buffs & debuffs'),
    effects.length ? effects : h('div', { class: 'tip-none' }, 'No active effects.'),
    h('div', { class: 'tip-section' }, 'Abilities'), abilities,
    h('div', { class: 'tip-section' }, 'Defenses'),
    h('div', {}, `Defense ${character.getStat(Stat.DEFENSE)}: reduces every hit by that much.`),
    resistances);
}

/**
 * @param {import('../../engine/Character.js').Character} character
 * @param {object} options { classes, onClick, plannedText, footer, badge, locked, lockText, title }
 */
export function characterCard(character, options = {}) {
  const theme = themeFor(character);
  const statusIcons = character.activeEffects.map((effect) => effect.icon).join(' ');
  const healthPercent = (100 * character.health) / character.maxHealth;
  const attack = character.getStat(Stat.ATTACK);
  const defense = character.getStat(Stat.DEFENSE);
  const speed = character.getStat(Stat.SPEED);
  const statClass = (value, base) => (value > base ? 'up' : value < base ? 'down' : '');

  const abilityRows = character.abilities.map((ability) => h('div', { class: ['tcg-ability', ability.currentCooldown > 0 && 'cooling'] },
    h('span', { class: 'pips', title: `Cooldown ${ability.cooldown}` }, '●'.repeat(ability.cooldown)),
    h('span', { class: 'ability-name' }, ability.name, ability.currentCooldown > 0 ? ` ⏳${ability.currentCooldown}` : ''),
    h('b', {}, ability.isSupportive && ability.power ? `+${ability.power}` : (ability.power || ''))));
  if (!abilityRows.length) {
    abilityRows.push(h('div', { class: 'tcg-ability' }, h('span', { class: 'pips' }), h('span', { class: 'ability-name' }, 'Basic Attack'), h('b', {}, character.basicAttack.power)));
  }

  const card = h('div', {
    class: ['tcg-card', options.classes, !character.isAlive() && 'defeated', options.onClick && 'clickable', options.locked && 'locked'],
    dataset: { uid: character.uid },
    cssVars: { '--light': theme.light, '--dark': theme.dark, '--frame': theme.frame },
    tabindex: options.onClick ? '0' : null,
    role: options.onClick ? 'button' : null,
    'aria-label': `${character.name}, ${character.typeLine}, health ${character.health} of ${character.maxHealth}${options.plannedText ? `, ${options.plannedText}` : ''}`,
    onclick: options.onClick,
    onkeydown: options.onClick ? (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        options.onClick(event);
      }
    } : null,
  },
  h('div', { class: ['tcg-gem', statClass(speed, character.speed)], title: 'Speed (acts earlier)' }, h('span', {}, speed)),
  h('div', { class: ['tcg-shield', statClass(defense, character.defense)], title: 'Defense' }, h('span', {}, defense)),
  h('div', { class: 'tcg-portrait' }, h('span', {}, character.portrait)),
  h('div', { class: 'tcg-ribbon' }, character.name),
  h('div', { class: ['health-bar', !character.isHero && 'enemy'] }, h('div', { style: { width: `${healthPercent}%` } })),
  h('div', { class: 'tcg-textbox' },
    abilityRows,
    h('div', { class: 'tcg-status', 'aria-label': 'Active effects' }, statusIcons),
    options.plannedText ? h('div', { class: 'planned-action' }, options.plannedText) : null,
    options.footer ?? null),
  h('div', { class: 'tcg-race' }, character.typeLine),
  h('div', { class: ['tcg-badge', 'attack', statClass(attack, character.attack)], title: 'Attack (scales damage and healing)' }, attack),
  h('div', { class: ['tcg-badge', 'health', character.health < character.maxHealth && 'damaged'], title: 'Health' }, character.health),
  options.badge ? h('div', { class: 'tcg-corner-badge', title: options.badge.title ?? '' }, options.badge.text) : null,
  options.locked ? h('div', { class: 'tcg-lock' }, h('span', {}, '🔒'), h('small', {}, options.lockText ?? 'Locked')) : null);

  if (!options.locked) attachTooltip(card, () => tooltipContent(character));
  return card;
}
