import { LIMITS } from '../../content/schema.js';
import {
  ALL_SCHOOLS, EFFECT_TYPE_LABELS, EffectCategory, EffectType, SCHOOL_LABELS, Stat, TARGET_LABELS,
} from '../../engine/types.js';
import { h, replaceChildren } from '../dom.js';
import { checkboxGroup, numberField, selectField, textField } from './fields.js';
import { defaultEffect, EFFECT_TYPE_OPTIONS } from './presets.js';

const SCHOOL_OPTIONS = ALL_SCHOOLS.map((school) => ({ value: school, label: SCHOOL_LABELS[school] }));
const CATEGORY_OPTIONS = Object.values(EffectCategory).map((category) => ({ value: category, label: category[0].toUpperCase() + category.slice(1) }));

/**
 * Editor for one status effect draft. Which fields show depends on the
 * effect type, so the editor re-renders itself when the type changes.
 */
export class StatusEffectEditor {
  constructor({ status, onChange, durationRange = LIMITS.duration }) {
    this.status = status;
    this.onChange = onChange;
    this.durationRange = durationRange;
    this.root = h('div', { class: 'status-editor' });
  }

  render() {
    const { status, onChange } = this;
    status.schools ??= [];
    const fields = [
      textField({ label: 'Effect name', draft: status, key: 'name', max: LIMITS.name, onChange }),
      textField({ label: 'Icon', draft: status, key: 'icon', max: LIMITS.portrait, onChange }),
      selectField({
        label: 'Type', draft: status, key: 'type', onChange: () => { this.#fixFields(); this.render(); onChange(); },
        options: Object.values(EffectType).map((type) => ({ value: type, label: EFFECT_TYPE_LABELS[type] })),
      }),
      selectField({ label: 'Category', draft: status, key: 'category', options: CATEGORY_OPTIONS, onChange, help: 'Cleanses remove effects by category.' }),
      numberField({ label: 'Duration (rounds)', draft: status, key: 'duration', range: this.durationRange, onChange }),
    ];

    if ([EffectType.BUFF, EffectType.DEBUFF].includes(status.type)) {
      fields.push(selectField({
        label: 'Stat', draft: status, key: 'stat', onChange: () => { this.render(); onChange(); },
        options: Object.values(Stat).map((stat) => ({ value: stat, label: stat[0].toUpperCase() + stat.slice(1) })),
      }));
      fields.push(numberField({ label: status.stat === Stat.RESISTANCE ? 'Amount (%)' : 'Amount', draft: status, key: 'magnitude', range: LIMITS.magnitude, onChange }));
      if (status.stat === Stat.RESISTANCE) fields.push(checkboxGroup({ label: 'Schools', values: status.schools, options: SCHOOL_OPTIONS, onChange }));
    }
    if ([EffectType.DAMAGE_OVER_TIME, EffectType.HEAL_OVER_TIME].includes(status.type)) {
      fields.push(numberField({ label: 'Per round', draft: status, key: 'magnitude', range: LIMITS.magnitude, onChange }));
    }
    if (status.type === EffectType.DAMAGE_OVER_TIME) {
      fields.push(selectField({ label: 'Damage school', draft: status, key: 'tickSchool', options: SCHOOL_OPTIONS, onChange }));
    }
    if (status.type === EffectType.IMMUNITY) {
      fields.push(checkboxGroup({ label: 'Immune to', values: status.schools, options: SCHOOL_OPTIONS, onChange }));
    }
    this.root.replaceChildren(h('div', { class: 'form-grid' }, fields));
    return this.root;
  }

  /** Give newly relevant fields a valid starting value when the type changes. */
  #fixFields() {
    const { status } = this;
    if ([EffectType.BUFF, EffectType.DEBUFF].includes(status.type)) status.stat ??= Stat.ATTACK;
    if (status.type === EffectType.DAMAGE_OVER_TIME) status.tickSchool ??= 'physical';
    if (status.type === EffectType.IMMUNITY && !status.schools.length) status.schools.push('physical');
    if ([EffectType.BUFF, EffectType.DEBUFF, EffectType.DAMAGE_OVER_TIME, EffectType.HEAL_OVER_TIME].includes(status.type) && !status.magnitude) status.magnitude = 5;
  }
}

/** Editor for one ability draft and its list of effects. */
export class AbilityEditor {
  constructor({ ability, index, onChange, onRemove, onMove, canRemove = true }) {
    this.ability = ability;
    this.index = index;
    this.onChange = onChange;
    this.onRemove = onRemove;
    this.onMove = onMove;
    this.canRemove = canRemove;
    this.root = h('fieldset', { class: 'ability-editor' });
  }

  render() {
    const { ability, onChange } = this;
    const needsPower = ability.effects.some((effect) => ['damage', 'heal', 'lifesteal'].includes(effect.type));

    const effects = ability.effects.map((effect, index) => this.#effectRow(effect, index));
    replaceChildren(this.root,
      h('legend', {}, `Ability ${this.index + 1}: ${ability.name || 'Unnamed'}`),
      h('div', { class: 'ability-tools' },
        this.onMove ? h('button', { type: 'button', class: 'icon-button', title: 'Move up', 'aria-label': 'Move ability up', onclick: () => this.onMove(-1) }, '▲') : null,
        this.onMove ? h('button', { type: 'button', class: 'icon-button', title: 'Move down', 'aria-label': 'Move ability down', onclick: () => this.onMove(1) }, '▼') : null,
        this.canRemove ? h('button', { type: 'button', class: 'icon-button danger', title: 'Remove ability', 'aria-label': 'Remove ability', onclick: () => this.onRemove() }, '✕') : null),
      h('div', { class: 'form-grid' },
        textField({ label: 'Name', draft: ability, key: 'name', max: LIMITS.name, onChange: () => { this.root.querySelector('legend').textContent = `Ability ${this.index + 1}: ${ability.name || 'Unnamed'}`; onChange(); } }),
        selectField({ label: 'Targets', draft: ability, key: 'target', onChange, options: Object.entries(TARGET_LABELS).map(([value, label]) => ({ value, label })) }),
        selectField({ label: 'School', draft: ability, key: 'school', onChange, options: SCHOOL_OPTIONS, help: 'Resistances and immunities check the school.' }),
        needsPower ? numberField({ label: 'Power', draft: ability, key: 'power', range: LIMITS.power, onChange, help: 'Scaled by attack: power × (1 + attack/100).' }) : null,
        numberField({ label: 'Cooldown (rounds)', draft: ability, key: 'cooldown', range: LIMITS.cooldown, onChange }),
        numberField({ label: 'Speed bonus', draft: ability, key: 'priority', range: LIMITS.priority, onChange, help: 'Added to speed for turn order. 10 = almost always first.' }),
        textField({ label: 'Description', draft: ability, key: 'description', max: LIMITS.description, multiline: true, onChange })),
      h('div', { class: 'effects' }, h('h4', {}, 'Effects (applied in order)'), effects),
      ability.effects.length < LIMITS.effects[1]
        ? h('button', { type: 'button', class: 'small', onclick: () => { ability.effects.push(defaultEffect('damage')); this.render(); onChange(); } }, '+ Add effect')
        : null);
    return this.root;
  }

  #effectRow(effect, index) {
    const { ability, onChange } = this;
    const typeSelect = selectField({
      label: `Effect ${index + 1}`,
      draft: { type: effect.type },
      key: 'type',
      options: EFFECT_TYPE_OPTIONS,
      onChange: (type) => {
        ability.effects[index] = defaultEffect(type);
        if (['damage', 'heal', 'lifesteal'].includes(type) && !ability.power) ability.power = 20;
        this.render();
        onChange();
      },
    });

    let details = null;
    if (effect.type === 'status') details = new StatusEffectEditor({ status: effect.status, onChange }).render();
    if (effect.type === 'lifesteal') details = numberField({ label: 'Heal self for (% of damage)', draft: effect, key: 'percent', range: LIMITS.lifesteal, onChange });
    if (effect.type === 'dispel') {
      details = h('div', { class: 'form-grid' },
        checkboxGroup({ label: 'Remove categories', values: effect.categories, options: CATEGORY_OPTIONS, onChange }),
        selectField({
          label: 'Removes', draft: { harmful: effect.harmful ? 'harmful' : 'helpful' }, key: 'harmful', onChange: (value) => { effect.harmful = value === 'harmful'; onChange(); },
          options: [{ value: 'harmful', label: 'Harmful effects (cleanse)' }, { value: 'helpful', label: 'Helpful effects (purge enemy buffs)' }],
        }));
    }

    return h('div', { class: 'effect-row' },
      h('div', { class: 'effect-head' }, typeSelect,
        ability.effects.length > 1 ? h('button', { type: 'button', class: 'icon-button danger', 'aria-label': 'Remove effect', onclick: () => { ability.effects.splice(index, 1); this.render(); onChange(); } }, '✕') : null),
      details);
  }
}
