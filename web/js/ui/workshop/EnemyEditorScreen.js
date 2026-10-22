import { defaultBehaviorRegistry } from '../../engine/behaviors/BehaviorRegistry.js';
import { EnemyRank } from '../../engine/types.js';
import { LIMITS } from '../../content/schema.js';
import { h } from '../dom.js';
import { StatusEffectEditor } from './AbilityEditor.js';
import { CharacterEditorScreen } from './CharacterEditorScreen.js';
import { numberField, section, selectField, textField } from './fields.js';
import { ABILITY_PRESETS, defaultPhaseStatus } from './presets.js';

export class EnemyEditorScreen extends CharacterEditorScreen {
  static kind = 'enemy';
  static label = 'enemy';
  static title = 'Enemy editor';

  blankDraft() {
    return {
      name: '', rank: EnemyRank.MINION, enemyType: 'physical', behavior: 'random', portrait: '👹', theme: 'stone', lore: '',
      health: 60, attack: 12, defense: 1, speed: 5, resistances: {}, basicAttackSchool: 'physical', phases: [],
      abilities: [ABILITY_PRESETS.find((preset) => preset.id === 'strike').build()],
    };
  }

  healthRange() {
    return this.draft.rank === EnemyRank.BOSS ? LIMITS.bossHealth : LIMITS.health;
  }

  renderIdentityExtras() {
    const { draft, update } = this;
    const behaviors = defaultBehaviorRegistry.options();
    return [
      selectField({
        label: 'Rank', draft, key: 'rank', options: [
          { value: 'minion', label: 'Minion' }, { value: 'elite', label: 'Elite' }, { value: 'boss', label: 'Boss (can have phases)' },
        ],
        onChange: () => {
          if (draft.rank !== EnemyRank.BOSS) draft.health = Math.min(draft.health, LIMITS.health[1]);
          draft.phases ??= [];
          this.rebuild();
        },
      }),
      selectField({ label: 'Type', draft, key: 'enemyType', onChange: update, options: [{ value: 'physical', label: 'Brute' }, { value: 'caster', label: 'Caster' }] }),
      selectField({
        label: 'Behavior', draft, key: 'behavior', onChange: update,
        options: behaviors.map((behavior) => ({ value: behavior.id, label: `${behavior.label} — ${behavior.description}` })),
        help: 'How this enemy chooses its moves.',
      }),
    ];
  }

  renderExtraSections() {
    const { draft, update } = this;
    if (draft.rank !== EnemyRank.BOSS) return [];
    draft.phases ??= [];
    const phases = draft.phases.map((phase, index) => h('fieldset', { class: 'ability-editor' },
      h('legend', {}, `Phase ${index + 1}`),
      h('div', { class: 'ability-tools' }, h('button', { type: 'button', class: 'icon-button danger', 'aria-label': 'Remove phase', onclick: () => { draft.phases.splice(index, 1); this.rebuild(); } }, '✕')),
      h('div', { class: 'form-grid' },
        numberField({ label: 'Triggers at health', draft: phase, key: 'atHealthPercent', range: [1, 99], suffix: '%', onChange: update }),
        textField({ label: 'Announcement', draft: phase, key: 'message', max: LIMITS.description, onChange: update })),
      h('h4', {}, 'Gains this effect'),
      new StatusEffectEditor({ status: phase.status, onChange: update, durationRange: LIMITS.phaseDuration }).render()));

    return [section('Boss phases', [
      h('div', { class: 'wide' }, phases,
        draft.phases.length < LIMITS.phases[1]
          ? h('button', {
            type: 'button',
            onclick: () => {
              draft.phases.push({ atHealthPercent: draft.phases.length ? 25 : 50, message: `${draft.name || 'The boss'} grows furious!`, status: defaultPhaseStatus() });
              this.rebuild();
            },
          }, '+ Add phase')
          : null),
    ], { description: 'When the boss first drops below a health threshold, it gains an effect (use a long duration to make it last the rest of the fight).' })];
  }
}
