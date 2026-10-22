import { h } from '../dom.js';

/** Small notifications in the corner: achievements, unlocks, "copied!", errors. */
export class Toaster {
  constructor() {
    this.container = h('div', { class: 'toasts', 'aria-live': 'polite' });
    document.body.append(this.container);
  }

  show(message, { icon = '', tone = 'info', duration = 3800, title = '' } = {}) {
    const toast = h('div', { class: ['toast', `toast-${tone}`], role: tone === 'error' ? 'alert' : 'status' },
      icon ? h('span', { class: 'toast-icon' }, icon) : null,
      h('div', {}, title ? h('b', {}, title) : null, title ? h('br') : null, message));
    this.container.append(toast);
    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 400);
    }, duration);
    return toast;
  }

  error(message) {
    return this.show(message, { icon: '⚠️', tone: 'error', duration: 6000 });
  }
}
