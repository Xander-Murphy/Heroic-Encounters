import { h, replaceChildren } from '../dom.js';

/**
 * One floating tooltip for the whole page. Any element registered with
 * attachTooltip(element, build) shows build()'s content on hover or focus.
 */
const builders = new WeakMap();
let tooltipElement = null;
let current = null;

function ensureElement() {
  if (tooltipElement) return tooltipElement;
  tooltipElement = h('div', { id: 'tooltip', role: 'tooltip' });
  document.body.append(tooltipElement);

  const show = (event) => {
    const target = event.target.closest?.('[data-tip]');
    if (!target) {
      hideTooltip();
      return;
    }
    if (target !== current) showTooltip(target);
  };
  document.addEventListener('mouseover', show);
  document.addEventListener('focusin', show);
  document.addEventListener('scroll', hideTooltip, { passive: true, capture: true });
  return tooltipElement;
}

export function attachTooltip(element, build) {
  ensureElement();
  builders.set(element, build);
  element.dataset.tip = '';
  return element;
}

export function hideTooltip() {
  if (tooltipElement) tooltipElement.style.display = 'none';
  current = null;
}

function showTooltip(target) {
  const build = builders.get(target);
  if (!build) return;
  current = target;
  replaceChildren(tooltipElement, build());
  tooltipElement.style.display = 'block';

  const box = target.getBoundingClientRect();
  const tip = tooltipElement.getBoundingClientRect();
  let left = box.right + 12;
  if (left + tip.width > window.innerWidth - 8) left = box.left - tip.width - 12;
  left = Math.max(8, Math.min(left, window.innerWidth - tip.width - 8));
  const top = Math.max(8, Math.min(box.top, window.innerHeight - tip.height - 8));
  tooltipElement.style.left = `${left}px`;
  tooltipElement.style.top = `${top}px`;
}
