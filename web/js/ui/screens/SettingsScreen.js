import { DEFAULT_SERVER_URL } from '../../config.js';
import { copyToClipboard, h, percent } from '../dom.js';
import { Screen, screenHeader } from '../Screen.js';
import { Modal } from '../components/Modal.js';

/** Account, name, accessibility, analytics consent, server address, save backup and the server's key metrics. */
export class SettingsScreen extends Screen {
  static nav = 'settings';
  static title = 'Settings';

  enter() {
    this.busy = false;
    // Kept across re-renders (e.g. when metrics arrive) so typing isn't wiped.
    this.usernameInput = h('input', { type: 'text', name: 'username', autocomplete: 'username', maxlength: 24, required: true, 'aria-label': 'Username' });
    this.passwordInput = h('input', { type: 'password', name: 'password', autocomplete: 'current-password', minlength: 8, maxlength: 200, required: true, 'aria-label': 'Password' });
    this.listen('account.changed', () => this.refresh());
    this.listen('account.synced', () => this.refresh());
    this.listen('server.status', () => this.#loadMetrics());
    this.metrics = null;
    this.#loadMetrics();
  }

  #loadMetrics() {
    if (!this.services.api.available) return;
    this.services.api.metricsSummary().then((summary) => { this.metrics = summary; this.refresh(); }).catch(() => {});
  }

  render() {
    const { settings, saveSettings, profile } = this.services;
    const nameInput = h('input', { type: 'text', maxlength: 32, value: profile.data.playerName, 'aria-label': 'Player name' });

    return [
      screenHeader('Settings'),
      h('div', { class: 'settings-grid' },
        this.#accountPanel(),

        h('section', { class: 'panel' },
          h('h2', {}, 'Player'),
          h('label', { class: 'field' }, 'Creator name (shown on content you share)', nameInput),
          h('button', {
            onclick: () => {
              profile.setPlayerName(nameInput.value);
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
          h('p', {}, 'Your progress and every hero, enemy and dungeon you made or imported live in this browser (and in your account, if you\'re signed in). Make a backup string to move them without an account or keep them safe.'),
          h('div', { class: 'row-left' },
            h('button', { onclick: () => this.#exportSave() }, '📤 Copy backup'),
            h('button', { onclick: () => this.#importSave() }, '📥 Restore backup')),
          h('hr'),
          h('button', { class: 'danger', onclick: () => this.#reset() }, 'Reset all progress')),

        h('section', { class: 'panel' },
          h('h2', {}, 'Community server'),
          h('p', { class: 'muted' }, DEFAULT_SERVER_URL
            ? `Leave empty to use the shared server (${DEFAULT_SERVER_URL}). Set an address to use a different one, e.g. one you host for friends.`
            : 'Leave empty to use the server this page came from. Set an address (e.g. https://my-server.example) if you host the game files somewhere else, like GitHub Pages.'),
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
        api.baseUrl = (input.value.trim() || DEFAULT_SERVER_URL).replace(/\/+$/, '');
        const ok = await api.checkHealth();
        this.app.toaster.show(ok ? 'Connected to the community server.' : 'Could not reach that server. Playing offline.', { icon: ok ? '🌐' : '🔌', tone: ok ? 'good' : 'info' });
        location.reload();
      },
    }, input, h('button', { type: 'submit' }, 'Save & reconnect'));
  }

  #accountPanel() {
    const { api, account } = this.services;
    const user = account.user;
    if (!api.available) {
      return h('section', { class: 'panel' },
        h('h2', {}, 'Account'),
        h('p', { class: 'muted' }, api.connecting
          ? 'Connecting to the community server… It sleeps when nobody has played for a while and can take up to a minute to wake up.'
          : user
          ? `Signed in as ${user.username}, but the community server isn't reachable. Your progress is saved here and will sync when you're back online.`
          : 'Accounts need the community server, which isn\'t reachable right now. You can keep playing; progress is saved in this browser.'));
    }

    if (user) {
      const synced = account.lastSyncedAt ? `Last synced ${new Date(account.lastSyncedAt).toLocaleString()}.` : 'Not synced yet.';
      return h('section', { class: 'panel' },
        h('h2', {}, 'Account'),
        h('p', {}, 'Signed in as ', h('b', {}, user.username), '. Your progress and creations sync to your account automatically, so you can pick up on any device.'),
        h('p', { class: 'muted' }, synced),
        h('div', { class: 'row-left' },
          h('button', { disabled: this.busy, onclick: () => this.#accountAction(async () => {
            const ok = await account.sync();
            this.app.toaster.show(ok ? 'Progress synced.' : 'Could not sync right now.', { icon: ok ? '☁️' : '🔌', tone: ok ? 'good' : 'info' });
          }) }, '☁️ Sync now'),
          h('button', { disabled: this.busy, onclick: () => this.#accountAction(async () => {
            await account.logout();
            this.app.toaster.show('Signed out. Your progress stays in this browser.', { icon: '👋' });
          }) }, 'Sign out')));
    }

    const { usernameInput: username, passwordInput: password } = this;
    const submit = (mode) => this.#accountAction(async () => {
      const signedIn = mode === 'register'
        ? await account.register(username.value.trim(), password.value)
        : await account.login(username.value.trim(), password.value);
      password.value = '';
      this.app.toaster.show(mode === 'register' ? `Welcome, ${signedIn.username}! Your progress now saves to your account.` : `Signed in as ${signedIn.username}.`, { icon: '🔑', tone: 'good' });
    });
    return h('form', {
      class: 'panel',
      onsubmit: (event) => {
        event.preventDefault();
        submit(event.submitter?.value === 'register' ? 'register' : 'login');
      },
    },
    h('h2', {}, 'Account'),
    h('p', {}, 'Sign in to save your progress and creations online and play on any device. Anything already in this browser is added to the account.'),
    h('label', { class: 'field' }, 'Username', username),
    h('label', { class: 'field' }, 'Password (at least 8 characters)', password),
    h('div', { class: 'row-left' },
      h('button', { class: 'primary', type: 'submit', value: 'login', disabled: this.busy }, 'Sign in'),
      h('button', { type: 'submit', value: 'register', disabled: this.busy }, 'Create account')));
  }

  async #accountAction(task) {
    this.busy = true;
    this.refresh();
    try {
      await task();
    } catch (error) {
      this.app.toaster.error(error.message);
    }
    this.busy = false;
    this.refresh();
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
    const signedIn = Boolean(this.services.account.user);
    const sure = await Modal.confirm('Reset everything?', signedIn
      ? 'You\'ll be signed out, and your level, achievements and content will be deleted from this browser. Your account keeps its copy: sign in again to get it back.'
      : 'Your level, achievements, and every hero, enemy and dungeon you made or imported will be deleted from this browser. Make a backup first if you might want them back.', { confirmLabel: 'Delete everything', danger: true });
    if (!sure) return;
    if (signedIn) await this.services.account.logout();
    ['profile', 'library', 'library-deleted', 'settings', 'account'].forEach((key) => this.services.adapter.remove(key));
    location.reload();
  }
}
