import { h } from '../dom.js';

/**
 * Accessible dialog built on <dialog>. open() resolves with the value passed
 * to close(), or null if dismissed (Esc / backdrop / Cancel).
 */
export class Modal {
  constructor({ title, body, actions = [], wide = false }) {
    this.title = title;
    this.body = body;
    this.actions = actions;
    this.wide = wide;
  }

  open() {
    return new Promise((resolve) => {
      const close = (value = null) => {
        dialog.close();
        dialog.remove();
        resolve(value);
      };
      const buttons = this.actions.map((action) => h('button', {
        class: action.primary ? 'primary' : action.danger ? 'danger' : '',
        onclick: async () => {
          const result = action.onClick ? await action.onClick(close) : action.value;
          if (result !== undefined) close(result);
        },
      }, action.label));

      const dialog = h('dialog', { class: ['modal', this.wide && 'wide'], 'aria-label': this.title },
        h('div', { class: 'modal-head' }, h('h2', {}, this.title), h('button', { class: 'icon-button', 'aria-label': 'Close', onclick: () => close(null) }, '✕')),
        h('div', { class: 'modal-body' }, typeof this.body === 'function' ? this.body(close) : this.body),
        buttons.length ? h('div', { class: 'modal-actions' }, buttons) : null);

      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        close(null);
      });
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) close(null);
      });
      document.body.append(dialog);
      dialog.showModal();
    });
  }

  static confirm(title, message, { confirmLabel = 'Confirm', danger = false } = {}) {
    return new Modal({
      title,
      body: h('p', {}, message),
      actions: [
        { label: 'Cancel', value: false },
        { label: confirmLabel, value: true, primary: !danger, danger },
      ],
    }).open().then(Boolean);
  }
}
