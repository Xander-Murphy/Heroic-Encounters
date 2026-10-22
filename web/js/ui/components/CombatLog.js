import { h, replaceChildren } from '../dom.js';

/**
 * Round-by-round battle log with filter buttons: Latest, All, a whole wave
 * or a single round. Used small on the combat screen and large on the summary.
 */
export class CombatLog {
  constructor({ entries, large = false, showLatest = true }) {
    this.entries = entries; // [{ wave, round, label, lines[] }]
    this.large = large;
    this.showLatest = showLatest;
    this.selection = showLatest ? 'latest' : 'all';
    this.root = h('div', { class: ['combat-log-wrap', large && 'large'] });
  }

  setEntries(entries) {
    this.entries = entries;
    if (this.showLatest) this.selection = 'latest';
    return this.render();
  }

  select(selection) {
    this.selection = selection;
    this.render();
  }

  #visible() {
    const { entries, selection } = this;
    if (selection === 'latest') return entries.slice(-2);
    if (selection === 'all') return entries;
    if (selection.startsWith('wave-')) return entries.filter((entry) => entry.wave === Number(selection.slice(5)));
    return [entries[Number(selection.slice(6))]].filter(Boolean);
  }

  render() {
    const button = (label, value) => h('button', {
      class: ['log-btn', this.selection === value && 'active'],
      onclick: () => this.select(value),
    }, label);

    const waves = [...new Set(this.entries.map((entry) => entry.wave))];
    const groups = waves.map((wave) => {
      const first = this.entries.find((entry) => entry.wave === wave);
      const rounds = this.entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.wave === wave);
      return h('div', { class: 'log-group' },
        button(first.label.startsWith('Boss') ? 'Boss' : `Wave ${wave + 1}`, `wave-${wave}`),
        rounds.map(({ entry, index }) => button(`R${entry.round}`, `round-${index}`)));
    });

    const log = h('div', { class: 'combat-log', role: 'log', 'aria-live': 'polite' },
      this.#visible().map((entry) => [
        h('div', { class: 'log-heading' }, `${entry.label.startsWith('Boss') ? 'Boss' : `Wave ${entry.wave + 1}`} · Round ${entry.round}`),
        entry.lines.map((line) => h('div', { class: 'log-line' }, line)),
      ]));

    replaceChildren(this.root,
      h('div', { class: 'log-controls' }, this.showLatest ? button('Latest', 'latest') : null, button('All', 'all'), groups),
      log,
    );
    if (this.selection === 'latest' || this.selection === 'all') requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
    return this.root;
  }
}
