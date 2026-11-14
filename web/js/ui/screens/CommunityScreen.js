import { h, plural } from '../dom.js';
import { Screen, screenHeader } from '../Screen.js';
import { Modal } from '../components/Modal.js';
import { emptyState, tabs } from '../components/widgets.js';

const KIND_ICON = { hero: '🦸', enemy: '👹', dungeon: '🏰' };

/**
 * Import from friends (share strings, links, codes) and browse the community
 * database. Browsing needs the server; importing a share string never does.
 */
export class CommunityScreen extends Screen {
  static nav = 'community';
  static title = 'Community';

  enter() {
    this.kind = '';
    this.sort = 'popular';
    this.query = '';
    this.results = null;
    this.loading = false;
    this.error = null;
    this.listen('server.status', () => this.#load());
    this.#load();
  }

  render() {
    const { api } = this.services;
    return [
      screenHeader('Community', 'Play what other people made, and share what you make.'),
      this.#importPanel(),
      h('h2', {}, 'Browse community creations'),
      api.available ? this.#browser() : this.#offlineNote(),
    ];
  }

  #importPanel() {
    const input = h('textarea', { rows: 3, placeholder: 'Paste a share string (HE1.…), a share link, or a community code like K7F2-QX9P', 'aria-label': 'Share string or code' });
    return h('form', {
      class: 'panel import-panel',
      onsubmit: async (event) => {
        event.preventDefault();
        if (!input.value.trim()) return;
        const report = await this.app.importFromText(input.value);
        if (report) input.value = '';
      },
    },
    h('h2', {}, '📥 Import from a friend'),
    input,
    h('div', { class: 'row-left' }, h('button', { class: 'primary', type: 'submit' }, 'Preview & import'),
      h('small', { class: 'muted' }, 'You\'ll see exactly what gets added before anything changes.')));
  }

  #offlineNote() {
    if (this.services.api.connecting) {
      return emptyState('⏳', 'Connecting to the community server…',
        'The server sleeps when nobody has played for a while and takes up to a minute to wake up. You can import share strings above in the meantime.');
    }
    return emptyState('🔌', 'Community server not connected',
      'You\'re playing offline (for example from a static host or a local file server). Share strings and links still work — paste them above. To browse and publish, start the game with "npm start" or set a server address in Settings.');
  }

  async #load() {
    const { api } = this.services;
    if (!api.available) return;
    this.loading = true;
    this.error = null;
    try {
      const { items } = await api.list({ kind: this.kind, sort: this.sort, q: this.query });
      this.results = items;
    } catch (error) {
      this.error = error.message;
    }
    this.loading = false;
    this.refresh();
  }

  #browser() {
    const searchInput = h('input', { type: 'search', placeholder: 'Search titles or creators', value: this.query, 'aria-label': 'Search' });
    const controls = h('div', { class: 'browser-controls' },
      tabs([{ id: '', label: 'All' }, { id: 'hero', label: 'Heroes' }, { id: 'enemy', label: 'Enemies' }, { id: 'dungeon', label: 'Dungeons' }],
        this.kind, (id) => { this.kind = id; this.#load(); }),
      h('form', { class: 'row-left', onsubmit: (event) => { event.preventDefault(); this.query = searchInput.value.trim(); this.#load(); } },
        searchInput,
        h('select', { 'aria-label': 'Sort', onchange: (event) => { this.sort = event.target.value; this.#load(); } },
          h('option', { value: 'popular', selected: this.sort === 'popular' }, 'Most popular'),
          h('option', { value: 'recent', selected: this.sort === 'recent' }, 'Newest')),
        h('button', { type: 'submit' }, 'Search')));

    let body;
    if (this.error) body = h('p', { class: 'warning' }, this.error);
    else if (this.loading && !this.results) body = h('p', { class: 'muted' }, 'Loading…');
    else if (!this.results?.length) body = emptyState('🌱', 'Nothing here yet', 'Be the first: make something in the Workshop and press Share → Publish.');
    else body = h('div', { class: 'community-list' }, this.results.map((entry) => this.#entry(entry)));
    return h('div', {}, controls, body);
  }

  #entry(entry) {
    const { library, api, profile, sharing } = this.services;
    const owned = (entry.itemIds ?? []).some((id) => library.has(id))
      || library.customEntries().some(({ meta }) => meta.origin?.code === entry.code || meta.publishedCode === entry.code);
    // Imported before the creator's latest update?
    const outdated = entry.updatedAt && library.customEntries().some(({ meta }) => meta.source === 'imported'
      && meta.origin?.code === entry.code && (meta.origin.importedAt ?? 0) < Date.parse(entry.updatedAt));
    const like = h('button', {
      class: 'small',
      onclick: async () => {
        like.disabled = true;
        try {
          const result = await api.like(entry.code, profile.data.installId);
          like.textContent = `👍 ${result.likes}`;
        } catch (error) {
          this.app.toaster.error(error.message);
          like.disabled = false;
        }
      },
    }, `👍 ${entry.likes}`);

    return h('article', { class: 'community-entry' },
      h('div', { class: 'community-icon' }, KIND_ICON[entry.kind] ?? '❔'),
      h('div', { class: 'community-info' },
        h('h3', {}, entry.title),
        h('div', { class: 'muted' }, `by ${entry.author || 'anonymous'} · ${new Date(entry.createdAt).toLocaleDateString()}${entry.updatedAt ? ` · updated ${new Date(entry.updatedAt).toLocaleDateString()}` : ''} · ${plural(entry.itemCount, 'item')} · ${entry.downloads} downloads`),
        entry.description ? h('p', {}, entry.description) : null,
        h('code', { class: 'code-chip', title: 'Community code' }, entry.code)),
      h('div', { class: 'community-actions' },
        entry.mine ? h('span', { class: 'pill pill-info' }, 'Your upload') : null,
        outdated ? h('button', { class: 'primary small', onclick: async () => { if (await this.app.importFromText(entry.code)) this.#load(); } }, '🔄 Update') : null,
        !outdated && owned && !entry.mine ? h('span', { class: 'pill pill-good' }, 'In your collection') : null,
        !owned ? h('button', { class: 'primary small', onclick: async () => { if (await this.app.importFromText(entry.code)) this.#load(); } }, '📥 Get') : null,
        like,
        entry.mine ? h('button', {
          class: 'danger small',
          onclick: async () => {
            const sure = await Modal.confirm(`Remove ${entry.title} from the community?`, 'Your own copy stays in your Workshop, and players who already imported it keep theirs. Its code stops working.', { confirmLabel: 'Remove', danger: true });
            if (!sure) return;
            try {
              await sharing.unpublish(entry.code);
              this.app.toaster.show(`${entry.title} removed from the community.`, { icon: '🗑️' });
              this.#load();
            } catch (error) {
              this.app.toaster.error(error.message);
            }
          },
        }, '🗑️ Remove') : null));
  }
}

