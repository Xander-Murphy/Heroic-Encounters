import { ratePower } from '../../content/powerBudget.js';
import { LIMITS } from '../../content/schema.js';
import { ALL_SCHOOLS, SCHOOL_LABELS } from '../../engine/types.js';
import { h } from '../dom.js';
import { characterCard } from '../components/Card.js';
import { AbilityEditor } from './AbilityEditor.js';
import { EditorScreen } from './EditorScreen.js';
import {
  numberField, portraitPicker, section, selectField, textField, themePicker,
} from './fields.js';
import { ABILITY_PRESETS } from './presets.js';

/**
 * Form sections shared by heroes and enemies (they share the engine's
 * Character base class, so their editors share this one). Subclasses add
 * their own identity fields via renderIdentityExtras() and extra sections
 * via renderExtraSections().
 */
export class CharacterEditorScreen extends EditorScreen {
  healthRange() {
    return LIMITS.health;
  }

  renderIdentityExtras() {
    return [];
  }

  renderExtraSections() {
    return [];
  }

  renderForm() {
    const { draft, update } = this;
    draft.resistances ??= {};
    return [
      section('Identity', [
        textField({ label: 'Name', draft, key: 'name', max: LIMITS.name, onChange: update, required: true }),
        ...this.renderIdentityExtras(),
        portraitPicker({ draft, key: 'portrait', onChange: update }),
        themePicker({ draft, key: 'theme', onChange: update }),
        textField({ label: 'Lore (optional)', draft, key: 'lore', max: LIMITS.lore, multiline: true, onChange: update }),
      ]),
      section('Stats', [
        numberField({ label: 'Health', draft, key: 'health', range: this.healthRange(), onChange: update }),
        numberField({ label: 'Attack', draft, key: 'attack', range: LIMITS.attack, onChange: update, help: 'Each point adds 1% to damage and healing.' }),
        numberField({ label: 'Defense', draft, key: 'defense', range: LIMITS.defense, onChange: update, help: 'Flat reduction to every hit taken.' }),
        numberField({ label: 'Speed', draft, key: 'speed', range: LIMITS.speed, onChange: update, help: 'Higher speed acts earlier in the round.' }),
        selectField({ label: 'Basic attack school', draft, key: 'basicAttackSchool', onChange: update, options: ALL_SCHOOLS.map((school) => ({ value: school, label: SCHOOL_LABELS[school] })) }),
      ]),
      section('Resistances', ALL_SCHOOLS.map((school) => numberField({
        label: SCHOOL_LABELS[school], draft: draft.resistances, key: school, range: LIMITS.resistance, suffix: '%', onChange: update,
      })), { open: false, description: 'Positive values reduce damage from that school; negative values are weaknesses.' }),
      ...this.renderExtraSections(),
      section(`Abilities (${draft.abilities.length}/${LIMITS.abilities[1]})`, [this.#abilityList()], { description: 'Everyone also has a Basic Attack that is always available.' }),
    ];
  }

  #abilityList() {
    const { draft } = this;
    const editors = draft.abilities.map((ability, index) => new AbilityEditor({
      ability,
      index,
      onChange: this.update,
      canRemove: draft.abilities.length > LIMITS.abilities[0],
      onRemove: () => { draft.abilities.splice(index, 1); this.rebuild(); },
      onMove: draft.abilities.length > 1 ? (direction) => {
        const target = index + direction;
        if (target < 0 || target >= draft.abilities.length) return;
        [draft.abilities[index], draft.abilities[target]] = [draft.abilities[target], draft.abilities[index]];
        this.rebuild();
      } : null,
    }).render());

    const adder = draft.abilities.length < LIMITS.abilities[1]
      ? h('div', { class: 'ability-adder' },
        h('label', {}, 'Add an ability from a template:'),
        h('div', { class: 'preset-grid' }, ABILITY_PRESETS.map((preset) => h('button', {
          type: 'button',
          class: 'small',
          onclick: () => { draft.abilities.push(preset.build()); this.rebuild(); },
        }, preset.label))))
      : null;
    return h('div', { class: 'ability-list wide' }, editors, adder);
  }

  renderPreview(value) {
    const character = this.services.library.factory.createCharacter(value);
    const rating = ratePower(value);
    const percentOfBaseline = Math.round(rating.ratio * 100);
    return h('div', {},
      h('div', { class: 'preview-card' }, characterCard(character)),
      h('div', { class: 'power-meter' },
        h('div', { class: 'power-head' }, h('b', {}, 'Power rating: '), h('span', { style: { color: rating.tier.color } }, rating.tier.label)),
        h('div', { class: 'progress', title: `${rating.score} vs. built-in average ${rating.baseline}` },
          h('div', { style: { width: `${Math.min(100, percentOfBaseline / 2)}%`, background: rating.tier.color } })),
        h('small', { class: 'muted' }, `${percentOfBaseline}% of a typical built-in ${value.kind === 'hero' ? 'hero' : value.rank}. Friends see this label when you share.`)));
  }
}
