/**
 * Tiny DOM helpers.
 *
 * All UI is built with h(), which sets text with textContent — never
 * innerHTML — so names and descriptions from shared content can't inject
 * markup or scripts into another player's game.
 */

const BOOLEAN_PROPS = new Set(['disabled', 'checked', 'selected', 'hidden', 'readOnly', 'multiple', 'open']);

/**
 * h('button', { class: 'primary', onclick: fn }, 'Save')
 * Attributes: class (string or array), style (object), dataset (object),
 * on* (event handlers), value/checked/disabled (properties), anything else as an attribute.
 */
export function h(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') element.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
    else if (key === 'style' && typeof value === 'object') Object.assign(element.style, value);
    else if (key === 'cssVars') Object.entries(value).forEach(([name, cssValue]) => element.style.setProperty(name, cssValue));
    else if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value') element.value = value;
    else if (BOOLEAN_PROPS.has(key)) element[key] = Boolean(value);
    else element.setAttribute(key, value === true ? '' : String(value));
  }
  append(element, children);
  return element;
}

export function append(parent, children) {
  for (const child of [children].flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function replaceChildren(parent, ...children) {
  parent.replaceChildren();
  return append(parent, children);
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const plural = (count, word, pluralWord = `${word}s`) => `${count} ${count === 1 ? word : pluralWord}`;
export const percent = (value) => (value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`);

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = h('textarea', { value: text, style: { position: 'fixed', opacity: '0' } });
    document.body.append(area);
    area.select();
    const copied = document.execCommand?.('copy') ?? false;
    area.remove();
    return copied;
  }
}

export const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
