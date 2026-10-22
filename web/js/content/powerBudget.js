import { ContentFactory } from './ContentFactory.js';
import { CORE_ENEMIES } from './core/enemies.js';
import { CORE_HEROES } from './core/heroes.js';
import { validateDefinition } from './schema.js';

/**
 * A rough "how strong is this?" score for heroes and enemies.
 *
 * Shared content is labelled Fair / Strong / Overtuned relative to the
 * built-in roster, so friends can tell at a glance whether a downloaded hero
 * plays fair. It is informational: nothing is blocked by it.
 */

const TARGET_MULTIPLIER = {
  self: 0.8, single_ally: 1, all_allies: 1.6, single_enemy: 1, all_enemies: 1.8,
};

const factory = new ContentFactory();

function abilityScore(ability) {
  const effectValue = ability.effects.reduce((sum, effect) => sum + effect.budgetValue(ability), 0);
  return (effectValue * (TARGET_MULTIPLIER[ability.target] ?? 1) * 2.2) / (ability.cooldown + 1) + ability.priority * 0.3;
}

/** Score for a validated hero or enemy definition. */
export function powerScore(definition) {
  const character = factory.createCharacter(definition);
  const resistance = Object.values(character.resistances).reduce((sum, value) => sum + value, 0);
  const stats = character.maxHealth * 0.4 + character.attack * 2 + character.defense * 5 + character.speed * 2 + resistance * 0.15;
  const abilities = character.abilities.reduce((sum, ability) => sum + abilityScore(ability), 0);
  const phases = (definition.phases ?? []).length * 15;
  return Math.round(stats + abilities + phases);
}

const average = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const scoreAll = (definitions) => definitions.map((definition) => powerScore(validateDefinition(definition).value));

let baselines = null;

/** Average score of the built-in roster, per hero / enemy rank (computed once). */
function getBaselines() {
  if (!baselines) {
    baselines = {
      hero: average(scoreAll(CORE_HEROES)),
      minion: average(scoreAll(CORE_ENEMIES.filter((enemy) => enemy.rank === 'minion'))),
      elite: average(scoreAll(CORE_ENEMIES.filter((enemy) => enemy.rank === 'elite'))),
      boss: average(scoreAll(CORE_ENEMIES.filter((enemy) => enemy.rank === 'boss'))),
    };
  }
  return baselines;
}

export const PowerTier = Object.freeze({
  WEAK: { id: 'weak', label: 'Underpowered', color: '#7fa7c9' },
  FAIR: { id: 'fair', label: 'Fair', color: '#5aa55a' },
  STRONG: { id: 'strong', label: 'Strong', color: '#e0b34a' },
  OVERTUNED: { id: 'overtuned', label: 'Overtuned', color: '#c0453a' },
});

/** { score, baseline, ratio, tier } for a validated hero or enemy definition. */
export function ratePower(definition) {
  const score = powerScore(definition);
  const key = definition.kind === 'hero' ? 'hero' : (definition.rank ?? 'minion');
  const baseline = getBaselines()[key];
  const ratio = score / baseline;
  let tier = PowerTier.FAIR;
  if (ratio < 0.75) tier = PowerTier.WEAK;
  else if (ratio > 1.4) tier = PowerTier.OVERTUNED;
  else if (ratio > 1.15) tier = PowerTier.STRONG;
  return { score, baseline: Math.round(baseline), ratio, tier };
}
