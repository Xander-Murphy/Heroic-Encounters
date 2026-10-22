import { h } from './dom.js';

/**
 * Base class for every screen (State pattern: the App holds one current
 * screen and swaps it on navigation, like the original GameState enum).
 *
 * Subclasses override render() and, when needed, enter()/leave().
 */
export class Screen {
  /** Which nav item to highlight. */
  static nav = null;
  /** Document title suffix. */
  static title = '';
  /** Whether navigating here should add a browser-history entry. */
  static historyEnabled = true;

  constructor(app, params = {}) {
    this.app = app;
    this.services = app.services;
    this.params = params;
    this.root = h('section', { class: ['screen', `screen-${this.constructor.name.replace(/Screen$/, '').toLowerCase()}`] });
    this.disposers = [];
  }

  /** Called once before the first render. */
  enter() {}

  /** Called when navigating away. */
  leave() {
    this.disposers.forEach((dispose) => dispose());
  }

  /** Subscribe to an event bus event for as long as the screen is shown. */
  listen(event, handler) {
    this.disposers.push(this.services.events.on(event, handler));
  }

  render() {
    return h('p', {}, 'Empty screen');
  }

  refresh() {
    this.root.replaceChildren(...[this.render()].flat(Infinity).filter(Boolean));
    return this.root;
  }
}

/** Header with a title and optional subtitle/actions, shared by most screens. */
export function screenHeader(title, subtitle = null, actions = null) {
  return h('header', { class: 'screen-header' },
    h('div', {}, h('h1', {}, title), subtitle ? h('p', { class: 'muted' }, subtitle) : null),
    actions ? h('div', { class: 'header-actions' }, actions) : null);
}
