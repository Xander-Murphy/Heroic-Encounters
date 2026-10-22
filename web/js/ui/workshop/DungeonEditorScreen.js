import { ContentSource } from '../../content/ContentLibrary.js';
import { LIMITS } from '../../content/schema.js';
import { EnemyRank } from '../../engine/types.js';
import { h, plural } from '../dom.js';
import { characterCard } from '../components/Card.js';
import { EditorScreen } from './EditorScreen.js';
import {
  numberField, portraitPicker, section, selectField, textField, themePicker,
} from './fields.js';

const SOURCE_LABEL = { core: 'Built-in', created: 'Yours', imported: 'Imported' };

/** Build a dungeon from waves of enemies (built-in or custom) and a boss. */
export class DungeonEditorScreen extends EditorScreen {
  static kind = 'dungeon';
  static label = 'dungeon';
  static title = 'Dungeon editor';

  blankDraft() {
    return {
      name: '', description: '', icon: '🏰', theme: 'stone', difficulty: 2, scaling: 0.1, restBetweenWaves: 0.25,
      waves: [
        { enemies: ['core:ashen_brute', 'core:ember_shaman'], min: 2, max: 3 },
        { enemies: ['core:fen_ravager', 'core:bog_viper'], min: 2, max: 3 },
      ],
      boss: 'core:kragmor',
    };
  }

  #enemyGroups() {
    const { library } = this.services;
    const groups = { created: [], imported: [], core: [] };
    for (const enemy of library.enemies()) groups[library.meta(enemy.id).source].push(enemy);
    return groups;
  }

  renderForm() {
    const { draft, update } = this;
    const { library } = this.services;
    const bossOptions = library.enemies()
      .sort((a, b) => Number(b.rank === EnemyRank.BOSS) - Number(a.rank === EnemyRank.BOSS))
      .map((enemy) => ({ value: enemy.id, label: `${enemy.portrait} ${enemy.name}${enemy.rank === EnemyRank.BOSS ? ' (boss)' : ''} — ${SOURCE_LABEL[library.meta(enemy.id).source]}` }));

    return [
      section('Identity', [
        textField({ label: 'Name', draft, key: 'name', max: LIMITS.name, onChange: update, required: true }),
        portraitPicker({ draft, key: 'icon', onChange: update, label: 'Icon' }),
        themePicker({ draft, key: 'theme', onChange: update, label: 'Color' }),
        textField({ label: 'Description', draft, key: 'description', max: LIMITS.description, multiline: true, onChange: update }),
      ]),
      section('Rules', [
        numberField({ label: 'Difficulty (stars)', draft, key: 'difficulty', range: LIMITS.difficulty, onChange: update, help: 'Higher difficulty gives more renown.' }),
        numberField({ label: 'Enemy attack growth per wave', draft, key: 'scaling', range: LIMITS.scaling, step: 0.01, scale: 100, suffix: '%', onChange: update }),
        numberField({ label: 'Healing between waves', draft, key: 'restBetweenWaves', range: LIMITS.rest, step: 0.05, scale: 100, suffix: '%', onChange: update }),
      ]),
      section(`Waves (${draft.waves.length}/${LIMITS.waves[1]})`, [h('div', { class: 'wide' },
        draft.waves.map((wave, index) => this.#waveEditor(wave, index)),
        draft.waves.length < LIMITS.waves[1]
          ? h('button', { type: 'button', onclick: () => { draft.waves.push({ enemies: [], min: 2, max: 3 }); this.rebuild(); } }, '+ Add wave')
          : null)], { description: 'Each wave picks a random number of enemies (between min and max) from its pool.' }),
      section('Boss', [
        selectField({ label: 'Final boss', draft, key: 'boss', options: bossOptions, onChange: update, help: 'Make your own boss in the enemy editor with rank "Boss".' }),
      ]),
    ];
  }

  #waveEditor(wave, index) {
    const { draft, update } = this;
    const groups = this.#enemyGroups();
    const chip = (enemy) => {
      const selected = wave.enemies.includes(enemy.id);
      return h('button', {
        type: 'button',
        class: ['enemy-chip', selected && 'active'],
        'aria-pressed': String(selected),
        title: `${enemy.name}: ${enemy.health} HP, ${enemy.attack} attack`,
        onclick: (event) => {
          const position = wave.enemies.indexOf(enemy.id);
          if (position >= 0) wave.enemies.splice(position, 1);
          else if (wave.enemies.length < LIMITS.wavePool[1]) wave.enemies.push(enemy.id);
          else {
            this.app.toaster.show(`A wave pool holds at most ${LIMITS.wavePool[1]} enemies.`, { icon: 'ℹ️' });
            return;
          }
          event.currentTarget.classList.toggle('active');
          event.currentTarget.setAttribute('aria-pressed', String(wave.enemies.includes(enemy.id)));
          event.currentTarget.closest('fieldset').querySelector('.pool-count').textContent = `${wave.enemies.length} in pool`;
          update();
        },
      }, `${enemy.portrait} ${enemy.name}`);
    };

    return h('fieldset', { class: 'ability-editor wave-editor' },
      h('legend', {}, `Wave ${index + 1}`),
      h('div', { class: 'ability-tools' },
        draft.waves.length > 1 ? h('button', { type: 'button', class: 'icon-button danger', 'aria-label': 'Remove wave', onclick: () => { draft.waves.splice(index, 1); this.rebuild(); } }, '✕') : null),
      h('div', { class: 'form-grid' },
        numberField({ label: 'Fewest enemies', draft: wave, key: 'min', range: LIMITS.waveCount, onChange: () => { wave.max = Math.max(wave.max, wave.min); update(); } }),
        numberField({ label: 'Most enemies', draft: wave, key: 'max', range: LIMITS.waveCount, onChange: update })),
      h('div', { class: 'pool' },
        h('small', { class: 'pool-count muted' }, `${wave.enemies.length} in pool`),
        ['created', 'imported', 'core'].filter((source) => groups[source].length).map((source) => h('div', { class: 'pool-group' },
          h('small', { class: 'muted' }, SOURCE_LABEL[source]),
          h('div', { class: 'chips' }, groups[source].filter((enemy) => enemy.rank !== EnemyRank.BOSS || source !== ContentSource.CORE).map(chip))))));
  }

  renderPreview(value) {
    const { library } = this.services;
    const boss = library.get(value.boss);
    return h('div', { class: 'dungeon-preview' },
      h('div', { class: ['dungeon-card', 'selected', `theme-${value.theme}`] },
        h('div', { class: 'dungeon-icon' }, value.icon),
        h('div', { class: 'dungeon-info' },
          h('b', {}, value.name || 'Unnamed dungeon'),
          h('div', { class: 'stars' }, '★'.repeat(value.difficulty), h('span', { class: 'muted' }, '★'.repeat(5 - value.difficulty))),
          h('p', {}, value.description))),
      h('ol', { class: 'wave-summary' }, value.waves.map((wave) => h('li', {},
        `${wave.min === wave.max ? wave.min : `${wave.min}–${wave.max}`} from: `,
        wave.enemies.map((id) => library.get(id)?.portrait ?? '❔').join(' ') || h('i', {}, 'empty pool')))),
      boss ? h('div', {}, h('h3', {}, 'Boss'), h('div', { class: 'preview-card' }, characterCard(library.instantiate(boss.id), { classes: 'small' }))) : null,
      h('small', { class: 'muted' }, `${plural(value.waves.length, 'wave')} then the boss. Custom enemies are bundled automatically when you share.`));
  }
}
