import { copyToClipboard, h, percent } from '../dom.js';
import { Screen, screenHeader } from '../Screen.js';
import { Modal } from '../components/Modal.js';

/** Name, accessibility, analytics consent, server address, save backup and the server's key metrics. */
export class SettingsScreen extends Screen {
  static nav = 'settings';
  static title = 'Settings';

  enter() {
    this.metrics = null;
    if (this.services.api.available) {
      this.services.api.metricsSummary().then((summary) => { this.metrics = summary; this.refresh(); }).catch(() => {});
    }
  }

  render() {
    const { settings, saveSettings, profile } = this.services;
    const nameInput = h('input', { type: 'text', maxlength: 32, value: profile.data.playerName, 'aria-label': 'Player name' });

    return [
      screenHeader('Settings'),
      h('div', { class: 'settings-grid' },
        h('section', { class: 'panel' },
          h('h2', {}, 'Player'),
          h('label', { class: 'field' }, 'Creator name (shown on content you share)', nameInput),
          h('button', {
            onclick: () => {
              profile.data.playerName = nameInput.value.trim().slice(0, 32);
              this.services.saveProfile();
              this.app.toaster.show('Name saved.', { icon: '✅' });
            },
          }, 'Save name')),

        h('section', { class: 'panel' },
          h('h2', {}, 'Display'),
          h('label', { class: 'field' }, 'Animations',
            h('select', { onchange: (event) => saveSettings({ motion: event.target.value }) },
              h('option', { value: 'system', selected: settings.motion === 'system' }, 'Follow my system setting'),
              h('option', { value: 'full', selected: settings.motion === 'full' }, 'Full animations'),
              h('option', { value: 'reduced', selected: settings.motion === 'reduced' }, 'Reduced motion'))),
          h('label', { class: 'field' }, 'Combat speed',
            h('select', { onchange: (event) => saveSettings({ animationSpeed: Number(event.target.value) }) },
              [[0.75, 'Relaxed'], [1, 'Normal'], [1.6, 'Fast'], [2.5, 'Very fast']].map(([value, label]) => h('option', { value, selected: settings.animationSpeed === value }, label))))),

        h('section', { class: 'panel' },
          h('h2', {}, 'Privacy'),
          h('label', { class: 'check' },
            h('input', { type: 'checkbox', checked: settings.shareAnalytics, onchange: (event) => saveSettings({ shareAnalytics: event.target.checked }) }),
            'Share anonymous gameplay statistics with the community server'),
          h('p', { class: 'muted' }, 'Only event names like "run finished" with numbers such as rounds taken, tied to a random install id. No names, no content, no tracking across sites. It helps balance the game and decide what to build next.')),

        h('section', { class: 'panel' },
          h('h2', {}, 'Backup & devices'),
          h('p', {}, 'Your progress and every hero, enemy and dungeon you made or imported live in this browser. Make a backup string to move them to another browser or keep them safe.'),
          h('div', { class: 'row-left' },
            h('button', { onclick: () => this.#exportSave() }, '📤 Copy backup'),
            h('button', { onclick: () => this.#importSave() }, '📥 Restore backup')),
          h('hr'),
          h('button', { class: 'danger', onclick: () => this.#reset() }, 'Reset all progress')),

        h('section', { class: 'panel' },
          h('h2', {}, 'Community server'),
          h('p', { class: 'muted' }, 'Leave empty to use the server this page came from. Set an address (e.g. https://my-server.example) if you host the game files somewhere else, like GitHub Pages.'),
          this.#serverForm()),

        this.metrics ? this.#metricsPanel() : null),
    ];
  }

  #serverForm() {
    const { settings, saveSettings, api } = this.services;
    const input = h('input', { type: 'url', placeholder: 'https://…', value: settings.serverUrl, 'aria-label': 'Server address' });
    return h('form', {
      class: 'row-left',
      onsubmit: async (event) => {
        event.preventDefault();
        saveSettings({ serverUrl: input.value.trim() });
        api.baseUrl = input.value.trim().replace(/\/+$/, '');
        const ok = await api.checkHealth();
        this.app.toaster.show(ok ? 'Connected to the community server.' : 'Could not reach that server. Playing offline.', { icon: ok ? '🌐' : '🔌', tone: ok ? 'good' : 'info' });
        location.reload();
      },
    }, input, h('button', { type: 'submit' }, 'Save & reconnect'));
  }

  #metricsPanel() {
    const metrics = this.metrics;
    const row = (label, value) => h('tr', {}, h('th', { scope: 'row' }, label), h('td', {}, value));
    const peak = Math.max(1, ...metrics.dailyActiveLast7.map((day) => day.players));
    return h('section', { class: 'panel wide' },
      h('h2', {}, '📈 Game metrics (this server)'),
      h('p', { class: 'muted' }, 'The key metrics from the business plan, from anonymous statistics.'),
      h('div', { class: 'metrics-layout' },
        h('table', { class: 'stats-table' }, h('tbody', {},
          row('Players (all time)', metrics.players),
          row('Daily active players', metrics.dailyActive),
          row('Return rate after 1 day', percent(metrics.returnRate1Day)),
          row('Return rate after 7 days', percent(metrics.returnRate7Day)),
          row('Run completion (reached boss)', percent(metrics.runCompletion)),
          row('Heroes unlocked per player', metrics.heroesUnlockedPerPlayer?.toFixed(1) ?? '—'),
          row('Created / shared / imported', `${metrics.contentCreated} / ${metrics.contentShared} / ${metrics.contentImported}`))),
        h('div', { class: 'mini-chart', role: 'img', 'aria-label': `Daily active players, last 7 days: ${metrics.dailyActiveLast7.map((day) => day.players).join(', ')}` },
          metrics.dailyActiveLast7.map((day) => h('div', { class: 'bar-col', title: `${day.day}: ${day.players}` },
            h('span', { class: 'bar-value' }, day.players),
            h('div', { class: 'bar', style: { height: `${(100 * day.players) / peak}%` } }),
            h('small', {}, day.day.slice(5)))))));
  }

  async #exportSave() {
    const text = await this.services.saveTransfer.exportSave();
    const copied = await copyToClipboard(text);
    await new Modal({
      title: 'Your backup',
      body: h('div', {}, h('p', {}, copied ? 'Copied to your clipboard. Keep it somewhere safe.' : 'Copy this text and keep it somewhere safe.'),
        h('textarea', { class: 'share-string', rows: 6, readonly: true, value: text, onfocus: (event) => event.target.select() })),
      actions: [{ label: 'Done', value: true }],
    }).open();
  }

  async #importSave() {
    const area = h('textarea', { class: 'share-string', rows: 6, placeholder: 'Paste a backup string' });
    const confirmed = await new Modal({
      title: 'Restore a backup',
      body: h('div', {}, h('p', { class: 'warning' }, 'This replaces the progress and content in this browser.'), area),
      actions: [{ label: 'Cancel', value: false }, { label: 'Restore', value: true, danger: true }],
    }).open();
    if (!confirmed) return;
    try {
      await this.services.saveTransfer.importSave(area.value);
      location.reload();
    } catch (error) {
      this.app.toaster.error(error.message);
    }
  }

  async #reset() {
    const sure = await Modal.confirm('Reset everything?', 'Your level, achievements, and every hero, enemy and dungeon you made or imported will be deleted from this browser. Make a backup first if you might want them back.', { confirmLabel: 'Delete everything', danger: true });
    if (!sure) return;
    ['profile', 'library', 'settings'].forEach((key) => this.services.adapter.remove(key));
    location.reload();
  }
}
