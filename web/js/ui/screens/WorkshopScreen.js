import { ContentSource } from '../../content/ContentLibrary.js';
import { ratePower } from '../../content/powerBudget.js';
import { h, plural } from '../dom.js';
import { Screen, screenHeader } from '../Screen.js';
import { Modal } from '../components/Modal.js';
import { definitionPreview, openShareDialog } from '../components/ShareDialogs.js';
import { emptyState, tabs } from '../components/widgets.js';

const KINDS = [
  { id: 'hero', label: 'Heroes', single: 'hero', icon: '🦸', editor: 'edit-hero' },
  { id: 'enemy', label: 'Enemies', single: 'enemy', icon: '👹', editor: 'edit-enemy' },
  { id: 'dungeon', label: 'Dungeons', single: 'dungeon', icon: '🏰', editor: 'edit-dungeon' },
];

/** Everything the player made or imported, with create / edit / remix / share / delete. */
export class WorkshopScreen extends Screen {
  static nav = 'workshop';
  static title = 'Workshop';

  enter() {
    this.kind = this.params.kind ?? 'hero';
    this.disposers.push(this.services.library.subscribe(() => this.refresh()));
  }

  render() {
    const { library } = this.services;
    const kind = KINDS.find((entry) => entry.id === this.kind);
    const items = library.list(this.kind).filter((definition) => !library.isCore(definition.id));

    return [
      screenHeader('Workshop', 'Design your own heroes, enemies and dungeons. Everything is saved in this browser and works offline.',
        KINDS.map((entry) => h('button', { class: entry.id === this.kind ? 'primary' : '', onclick: () => this.app.navigate(entry.editor) }, `${entry.icon} New ${entry.single}`))),
      tabs(KINDS.map((entry) => ({
        id: entry.id, label: entry.label, count: library.list(entry.id).filter((definition) => !library.isCore(definition.id)).length,
      })), this.kind, (id) => { this.kind = id; this.refresh(); }),
      items.length
        ? h('div', { class: 'workshop-list' }, items.map((definition) => this.#item(definition, kind)))
        : emptyState(kind.icon, `No custom ${kind.label.toLowerCase()} yet`,
          kind.id === 'dungeon'
            ? 'A dungeon is a few waves of enemies and a boss. Use built-in enemies or your own creations.'
            : `Start from scratch or remix a built-in ${kind.single} to learn how they work.`,
          h('div', { class: 'row' },
            h('button', { class: 'primary', onclick: () => this.app.navigate(kind.editor) }, `Create a ${kind.single}`),
            h('button', { onclick: () => this.#pickTemplate(kind) }, 'Remix a built-in one'))),
    ];
  }

  #item(definition, kind) {
    const { library } = this.services;
    const meta = library.meta(definition.id);
    const imported = meta.source === ContentSource.IMPORTED;
    const rating = definition.kind === 'dungeon' ? null : ratePower(definition);
    const dependents = library.dependents(definition.id);

    return h('article', { class: 'workshop-item' },
      h('div', { class: 'workshop-preview' }, definitionPreview(definition, library)),
      h('div', { class: 'workshop-meta' },
        h('h3', {}, definition.name),
        h('div', { class: 'row-left' },
          h('span', { class: ['pill', imported ? 'pill-info' : 'pill-good'] }, imported ? `Imported${meta.origin?.author ? ` from ${meta.origin.author}` : ''}` : 'Your creation'),
          rating ? h('span', { class: 'pill', style: { borderColor: rating.tier.color, color: rating.tier.color }, title: `Power ${rating.score} (built-in average ${rating.baseline})` }, `⚖️ ${rating.tier.label}`) : null,
          meta.publishedCode ? h('span', { class: 'pill', title: 'Community code' }, `🌐 ${meta.publishedCode}`) : null,
          definition.kind === 'dungeon' && !library.isPlayable(definition) ? h('span', { class: 'pill pill-bad' }, 'Missing enemies') : null),
        dependents.length ? h('small', { class: 'muted' }, `Used by ${dependents.map((item) => item.name).join(', ')}`) : null,
        h('div', { class: 'row-left actions' },
          imported
            ? h('button', { onclick: () => this.app.navigate(kind.editor, { remixOf: definition.id }) }, '🎨 Remix')
            : h('button', { class: 'primary', onclick: () => this.app.navigate(kind.editor, { id: definition.id }) }, '✏️ Edit'),
          h('button', { onclick: () => openShareDialog(this.app, definition.id) }, '🎁 Share'),
          h('button', { class: 'danger', onclick: () => this.#delete(definition, dependents) }, '🗑️ Delete'))));
  }

  async #delete(definition, dependents) {
    const warning = dependents.length
      ? `${dependents.map((item) => item.name).join(', ')} ${dependents.length === 1 ? 'uses' : 'use'} it and will stop working until it's back.`
      : 'This cannot be undone (unless you still have a share string for it).';
    if (await Modal.confirm(`Delete ${definition.name}?`, warning, { confirmLabel: 'Delete', danger: true })) {
      this.services.library.remove(definition.id);
      this.app.toaster.show(`${definition.name} deleted.`, { icon: '🗑️' });
    }
  }

  async #pickTemplate(kind) {
    const { library } = this.services;
    const options = library.list(kind.id, { source: ContentSource.CORE });
    const choice = await new Modal({
      title: `Remix a built-in ${kind.single}`,
      wide: true,
      body: (close) => h('div', { class: 'template-grid' }, options.map((definition) => h('button', { class: 'template-option', onclick: () => close(definition.id) },
        h('span', { class: 'mini-portrait' }, definition.portrait ?? definition.icon), h('span', {}, definition.name),
        h('small', { class: 'muted' }, definition.className ?? (definition.abilities ? plural(definition.abilities.length, 'ability', 'abilities') : plural(definition.waves.length, 'wave')))))),
      actions: [{ label: 'Cancel', value: null }],
    }).open();
    if (choice) this.app.navigate(kind.editor, { remixOf: choice });
  }
}
