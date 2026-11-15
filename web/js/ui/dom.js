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

/**
 * Turns linear progress (0 → 1) into a gentle start and stop: slow at the
 * beginning, fastest in the middle, slow again at the end. The same curve as
 * CSS's ease-in-out, but cubic.
 */
function easeInOut(progress) {
  if (progress < 0.5) {
    // First half: speed up. Cubing makes small numbers grow slowly at first.
    const half = progress * 2; // 0 → 1 across the first half
    return (half ** 3) / 2; // covers 0 → 0.5 of the distance
  }
  // Second half: the first half's curve flipped around, so it slows down.
  const half = (1 - progress) * 2; // 1 → 0 across the second half
  return 1 - (half ** 3) / 2; // covers 0.5 → 1 of the distance
}

/**
 * Scroll the page so an element sits at the top (respecting its CSS
 * scroll-margin-top). With smooth set this animates the scroll itself rather
 * than using behavior: 'smooth', which browsers silently turn into a jump
 * when the OS asks for reduced motion, even if the player picked "Full
 * animations" in the game. Stops if the player scrolls during it.
 */
export function scrollToElement(element, { smooth = true } = {}) {
  const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  const maxY = document.documentElement.scrollHeight - window.innerHeight;
  const start = window.scrollY;
  const target = Math.max(0, Math.min(maxY, start + element.getBoundingClientRect().top - margin));
  const distance = target - start;
  if (!smooth || Math.abs(distance) < 2) {
    window.scrollTo(0, target);
    return;
  }

  const duration = Math.min(700, 250 + Math.abs(distance) * 0.4);
  let cancelled = false;
  const cancel = () => { cancelled = true; };
  const userInput = ['wheel', 'touchstart', 'keydown'];
  userInput.forEach((type) => window.addEventListener(type, cancel, { once: true, passive: true }));
  const began = performance.now();
  const step = (now) => {
    if (cancelled) return;
    const progress = Math.min(1, (now - began) / duration);
    window.scrollTo(0, start + distance * easeInOut(progress));
    if (progress < 1) requestAnimationFrame(step);
    else userInput.forEach((type) => window.removeEventListener(type, cancel));
  };
  requestAnimationFrame(step);
}
