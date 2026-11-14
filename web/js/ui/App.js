import { Animator } from './components/Animator.js';
import { openImportDialog } from './components/ShareDialogs.js';
import { Toaster } from './components/Toast.js';
import { hideTooltip } from './components/Tooltip.js';
import { h } from './dom.js';
import { GameSession } from './GameSession.js';
import { CombatScreen } from './screens/CombatScreen.js';
import { CommunityScreen } from './screens/CommunityScreen.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { PlayScreen } from './screens/PlayScreen.js';
import { ProfileScreen } from './screens/ProfileScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { SummaryScreen } from './screens/SummaryScreen.js';
import { WorkshopScreen } from './screens/WorkshopScreen.js';
import { DungeonEditorScreen } from './workshop/DungeonEditorScreen.js';
import { EnemyEditorScreen } from './workshop/EnemyEditorScreen.js';
import { HeroEditorScreen } from './workshop/HeroEditorScreen.js';

const SCREENS = Object.freeze({
  home: HomeScreen,
  play: PlayScreen,
  combat: CombatScreen,
  summary: SummaryScreen,
  workshop: WorkshopScreen,
  'edit-hero': HeroEditorScreen,
  'edit-enemy': EnemyEditorScreen,
  'edit-dungeon': DungeonEditorScreen,
  community: CommunityScreen,
  profile: ProfileScreen,
  settings: SettingsScreen,
});

const NAV = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'play', label: 'Play', icon: '⚔️' },
  { id: 'workshop', label: 'Workshop', icon: '🛠️' },
  { id: 'community', label: 'Community', icon: '🌐' },
  { id: 'profile', label: 'Profile', icon: '🏅' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

/**
 * The application shell: navigation, the current screen, toasts and
 * cross-screen helpers (session, animator). Screens are looked up in a
 * registry, so adding a screen never changes the navigation logic.
 */
export class App {
  constructor({ services, root }) {
    this.services = services;
    this.root = root;
    this.session = new GameSession(services);
    this.toaster = new Toaster();
    this.animator = new Animator({ getSettings: () => services.settings });
    this.current = null;
    this.navButtons = new Map();

    this.main = h('main', { id: 'main', tabindex: '-1' });
    this.status = h('span', { class: 'server-status', title: 'Community server' });
    root.replaceChildren(this.#buildHeader(), this.main);
  }

  async start() {
    const { services } = this;
    this.#wireNotifications();

    const welcome = services.progression.startSession();
    if (welcome.renown) this.toaster.show(`+${welcome.renown} renown for coming back today.`, { icon: '🌅', tone: 'good' });

    window.addEventListener('popstate', (event) => {
      const state = event.state;
      if (state?.screen && SCREENS[state.screen]) this.navigate(state.screen, state.params ?? {}, { fromHistory: true });
    });
    window.addEventListener('hashchange', () => this.#checkImportHash());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        services.analytics.flush();
        services.account.flush();
      }
    });

    this.navigate('home', {}, { replace: true });
    services.events.emit('session.start', {});

    await this.connect();
    this.#checkImportHash();
    window.addEventListener('online', () => { if (!services.api.available) this.connect(); });
  }

  /** Reach the community server (waking it up if needed), then start syncing. */
  async connect() {
    const { services } = this;
    const health = services.api.checkHealth();
    this.#updateServerStatus();
    await health;
    this.#updateServerStatus();
    services.events.emit('server.status', { online: services.api.available });
    services.analytics.flush();
    services.account.sync();
  }

  navigate(screenId, params = {}, { fromHistory = false, replace = false } = {}) {
    const ScreenClass = SCREENS[screenId];
    if (!ScreenClass) throw new Error(`Unknown screen: ${screenId}`);
    if (this.current?.confirmLeave && !this.current.confirmLeave(screenId)) return;

    hideTooltip();
    this.current?.leave();
    const screen = new ScreenClass(this, params);
    this.current = screen;
    screen.enter();
    this.main.replaceChildren(screen.refresh());

    for (const [id, button] of this.navButtons) {
      button.classList.toggle('active', id === ScreenClass.nav);
      button.setAttribute('aria-current', id === ScreenClass.nav ? 'page' : 'false');
    }
    document.title = ScreenClass.title ? `${ScreenClass.title} · Heroic Encounters` : 'Heroic Encounters';
    window.scrollTo({ top: 0 });

    if (!fromHistory && ScreenClass.historyEnabled) {
      const serializable = Object.fromEntries(Object.entries(params).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)));
      const method = replace ? 'replaceState' : 'pushState';
      history[method]({ screen: screenId, params: serializable }, '', location.pathname + location.search);
    }
  }

  /** Re-render the current screen (e.g. after content changes). */
  refresh() {
    this.current?.refresh();
  }

  async importFromText(text) {
    const report = await openImportDialog(this, text);
    if (report) this.refresh();
    return report;
  }

  #buildHeader() {
    const nav = h('nav', { class: 'main-nav', 'aria-label': 'Main' }, NAV.map((item) => {
      const button = h('button', { class: 'nav-btn', onclick: () => this.navigate(item.id) }, h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, item.icon), h('span', { class: 'nav-label' }, item.label));
      this.navButtons.set(item.id, button);
      return button;
    }));
    return h('header', { class: 'app-header' },
      h('a', { class: 'skip-link', href: '#main' }, 'Skip to content'),
      h('button', { class: 'brand', onclick: () => this.navigate('home') }, h('span', { class: 'brand-mark' }, '⚔️'), h('span', {}, 'Heroic Encounters')),
      nav,
      this.status);
  }

  #updateServerStatus() {
    const { available: online, connecting } = this.services.api;
    const user = this.services.account.user;
    this.status.className = `server-status ${online ? 'online' : 'offline'}`;
    if (connecting) {
      this.status.textContent = '● Connecting…';
      this.status.title = 'Waking up the community server. This can take up to a minute; you can play in the meantime.';
    } else {
      this.status.textContent = online ? `● Online${user ? ` · ${user.username}` : ''}` : '● Offline';
      this.status.title = online ? 'Connected to the community server' : 'Playing offline — community features need the server, everything else works';
    }
    this.refresh();
  }

  #wireNotifications() {
    const { events } = this.services;
    events.on('achievement.unlocked', ({ name, icon }) => this.toaster.show(name, { icon, title: 'Achievement unlocked', tone: 'gold' }));
    events.on('hero.unlocked', ({ name }) => this.toaster.show(`${name} has joined your roster!`, { icon: '🎉', title: 'New hero', tone: 'gold', duration: 5000 }));
    events.on('level.up', ({ level }) => this.toaster.show(`You reached level ${level}.`, { icon: '⭐', title: 'Level up', tone: 'gold' }));
    events.on('account.changed', () => this.#updateServerStatus());
    events.on('account.synced', ({ changed }) => {
      // Progress from another device arrived; redraw, but never in the middle of a fight.
      if (changed && !(this.current instanceof CombatScreen)) this.refresh();
    });
    events.on('account.syncFailed', ({ expired }) => {
      if (expired) this.toaster.show('You were signed out. Sign in again in Settings to keep syncing.', { icon: '🔑', tone: 'info' });
    });
  }

  #checkImportHash() {
    const match = location.hash.match(/^#(import|code)=(.+)$/);
    if (!match) return;
    const text = decodeURIComponent(match[2]);
    history.replaceState(history.state, '', location.pathname + location.search);
    this.importFromText(text);
  }
}
