/** Card color themes (shared by built-in and player-made content) and school colors. */
export const CARD_THEMES = Object.freeze({
  arcane: { label: 'Arcane Blue', light: '#6db4f5', dark: '#2c68bd', frame: '#1c4a8c' },
  gold: { label: 'Gold', light: '#fbe45c', dark: '#dcb423', frame: '#a8860f' },
  forest: { label: 'Forest', light: '#4f9a54', dark: '#24602f', frame: '#173f20' },
  earth: { label: 'Earth', light: '#b98655', dark: '#6b4426', frame: '#45290f' },
  ivory: { label: 'Ivory', light: '#fbf8ef', dark: '#cfc8b4', frame: '#8c8470' },
  steel: { label: 'Steel', light: '#c3ccd8', dark: '#7d8899', frame: '#4b5566' },
  jade: { label: 'Jade', light: '#7fd6b0', dark: '#2f8f6a', frame: '#1b5a42' },
  violet: { label: 'Violet', light: '#a577d8', dark: '#5b3a8a', frame: '#3b2260' },
  ocean: { label: 'Ocean', light: '#62c7d9', dark: '#1f6f8f', frame: '#134a60' },
  ember: { label: 'Ember', light: '#ff9d5c', dark: '#c4501f', frame: '#7e2f0f' },
  crimson: { label: 'Crimson', light: '#d85a4a', dark: '#7a1f1a', frame: '#4d100c' },
  shadow: { label: 'Shadow', light: '#6e6680', dark: '#2e2a38', frame: '#17151d' },
  stone: { label: 'Stone', light: '#9aa0aa', dark: '#565c68', frame: '#363a42' },
  rose: { label: 'Rose', light: '#f5a3c0', dark: '#c25683', frame: '#7d2f50' },
});

/** Theme used when content doesn't pick one. */
export function themeFor(character) {
  if (character.theme && CARD_THEMES[character.theme]) return CARD_THEMES[character.theme];
  if (character.isBoss) return CARD_THEMES.crimson;
  if (character.isHero) return CARD_THEMES.gold;
  return character.enemyType === 'caster' ? CARD_THEMES.violet : CARD_THEMES.stone;
}

export const SCHOOL_COLORS = Object.freeze({
  physical: '#e8e2d0', arcane: '#b06bff', fire: '#ff7a2a', frost: '#6fd0ff',
  holy: '#ffe9a0', nature: '#5fd16a', shadow: '#9a6bd0',
});

export const SCHOOL_ICONS = Object.freeze({
  physical: '⚔️', arcane: '🔮', fire: '🔥', frost: '❄️', holy: '✨', nature: '🌿', shadow: '🌑',
});

export const ROLE_ICONS = Object.freeze({ damage: '⚔️', tank: '🛡️', healer: '💚', support: '🎵' });

/** Quick-pick portraits for the workshop (players can also type any emoji). */
export const PORTRAIT_CHOICES = Object.freeze([
  '🧙', '🧝', '🧛', '🧟', '🥷', '🦸', '🦹', '🤺', '🏹', '🗡️', '🪓', '🛡️', '🔮', '✨', '🌿', '🕯️', '⚡', '🔥',
  '❄️', '💀', '👹', '👺', '🐉', '🐺', '🦂', '🐍', '🦇', '🕷️', '🐗', '🦅', '🐻', '🦁', '🐙', '🍄', '🌋', '🪨',
  '🤖', '👻', '👽', '🧌', '🎃', '🌊', '🌙', '☀️', '🎻', '⚙️', '🧪', '📜',
]);
