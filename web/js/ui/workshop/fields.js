import { THEMES } from '../../content/schema.js';
import { h } from '../dom.js';
import { CARD_THEMES, PORTRAIT_CHOICES } from '../themes.js';

/**
 * Form controls bound directly to a draft object: each writes
 * draft[key] and calls onChange() so the editor can refresh its preview.
 */

let fieldCounter = 0;
const nextId = () => `field-${++fieldCounter}`;

function wrap(label, control, { help, id, inline = false } = {}) {
  return h('div', { class: ['field', inline && 'inline'] },
    h('label', { for: id }, label),
    control,
    help ? h('small', { class: 'help' }, help) : null);
}

export function textField({ label, draft, key, max = 32, placeholder = '', multiline = false, onChange, help, required = false }) {
  const id = nextId();
  const control = h(multiline ? 'textarea' : 'input', {
    id, maxlength: max, placeholder, required, rows: multiline ? 3 : null, type: multiline ? null : 'text', value: draft[key] ?? '',
    oninput: (event) => {
      draft[key] = event.target.value;
      onChange();
    },
  });
  return wrap(label, control, { help, id });
}

/** Number input with a matching slider. `scale` shows e.g. 0.25 as 25. */
export function numberField({ label, draft, key, range: [min, max], step = 1, scale = 1, suffix = '', onChange, help }) {
  const id = nextId();
  const fallback = min <= 0 && max >= 0 ? 0 : min;
  const display = (value) => Math.round((value ?? fallback) * scale);
  const toValue = (shown) => (scale === 1 ? Math.round(shown) : Number((shown / scale).toFixed(3)));
  const shownMin = min * scale;
  const shownMax = max * scale;
  const shownStep = step * scale;

  const number = h('input', { id, type: 'number', min: shownMin, max: shownMax, step: shownStep, value: display(draft[key]) });
  const slider = h('input', { type: 'range', min: shownMin, max: shownMax, step: shownStep, value: display(draft[key]), 'aria-label': label, tabindex: '-1' });
  const set = (raw, source) => {
    const shown = Math.min(shownMax, Math.max(shownMin, Number(raw) || 0));
    draft[key] = toValue(shown);
    if (source !== number) number.value = shown;
    if (source !== slider) slider.value = shown;
    onChange();
  };
  number.addEventListener('input', () => { if (number.value !== '') set(number.value, number); });
  number.addEventListener('change', () => set(number.value, null));
  slider.addEventListener('input', () => set(slider.value, slider));
  return wrap(label, h('div', { class: 'number-field' }, number, suffix ? h('span', { class: 'suffix' }, suffix) : null, slider), { help, id });
}

export function selectField({ label, draft, key, options, onChange, help }) {
  const id = nextId();
  const select = h('select', {
    id,
    onchange: (event) => {
      const option = options[event.target.selectedIndex];
      draft[key] = option.value;
      onChange(option.value);
    },
  }, options.map((option) => h('option', { selected: option.value === draft[key] }, option.label)));
  return wrap(label, select, { help, id });
}

export function checkboxGroup({ label, values, options, onChange, help }) {
  return h('fieldset', { class: 'field checkbox-group' },
    h('legend', {}, label),
    h('div', { class: 'checkboxes' }, options.map((option) => h('label', { class: 'check' },
      h('input', {
        type: 'checkbox',
        checked: values.includes(option.value),
        onchange: (event) => {
          const index = values.indexOf(option.value);
          if (event.target.checked && index < 0) values.push(option.value);
          if (!event.target.checked && index >= 0) values.splice(index, 1);
          onChange();
        },
      }),
      option.label))),
    help ? h('small', { class: 'help' }, help) : null);
}

export function themePicker({ draft, key, onChange, label = 'Card color' }) {
  const swatches = THEMES.map((theme) => h('button', {
    type: 'button',
    class: ['swatch', draft[key] === theme && 'active'],
    title: CARD_THEMES[theme].label,
    'aria-label': CARD_THEMES[theme].label,
    'aria-pressed': String(draft[key] === theme),
    style: { background: `linear-gradient(135deg, ${CARD_THEMES[theme].light}, ${CARD_THEMES[theme].dark})`, borderColor: CARD_THEMES[theme].frame },
    onclick: (event) => {
      draft[key] = theme;
      event.currentTarget.parentElement.querySelectorAll('.swatch').forEach((swatch) => {
        swatch.classList.toggle('active', swatch === event.currentTarget);
        swatch.setAttribute('aria-pressed', String(swatch === event.currentTarget));
      });
      onChange();
    },
  }));
  return h('fieldset', { class: 'field' }, h('legend', {}, label), h('div', { class: 'swatches' }, swatches));
}

export function portraitPicker({ draft, key, onChange, label = 'Portrait' }) {
  const id = nextId();
  const input = h('input', {
    id, type: 'text', maxlength: 16, class: 'portrait-input', value: draft[key] ?? '',
    oninput: (event) => {
      draft[key] = event.target.value;
      onChange();
    },
  });
  const choices = h('div', { class: 'portrait-choices' }, PORTRAIT_CHOICES.map((emoji) => h('button', {
    type: 'button',
    class: 'portrait-choice',
    'aria-label': `Use ${emoji}`,
    onclick: () => {
      draft[key] = emoji;
      input.value = emoji;
      onChange();
    },
  }, emoji)));
  return wrap(label, h('div', {}, input, h('details', {}, h('summary', {}, 'Pick one'), choices)), { id, help: 'Any emoji works — paste or type your own.' });
}

/** A titled, collapsible section of a form. */
export function section(title, children, { open = true, description = null } = {}) {
  return h('details', { class: 'form-section', open },
    h('summary', {}, title),
    description ? h('p', { class: 'muted' }, description) : null,
    h('div', { class: 'form-grid' }, children));
}
