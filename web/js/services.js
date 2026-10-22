import { AccountService } from './account/AccountService.js';
import { Analytics, MemoryAnalyticsSink, RemoteAnalyticsSink } from './insights/Insights.js';
import { ApiClient } from './api/ApiClient.js';
import { DEFAULT_SERVER_URL } from './config.js';
import { ContentLibrary, newContentId } from './content/ContentLibrary.js';
import { EventBus } from './EventBus.js';
import { JsonStore, createDefaultAdapter } from './persistence/storage.js';
import { SaveTransfer } from './persistence/SaveTransfer.js';
import { Profile, defaultProfileData } from './progression/Profile.js';
import { ProgressionService } from './progression/ProgressionService.js';
import { ShareService } from './sharing/ShareService.js';

export const defaultSettings = () => ({
  shareAnalytics: true,
  motion: 'system', // 'system' | 'full' | 'reduced'
  animationSpeed: 1,
  serverUrl: '',
});

/**
 * Composition root: builds every service once and wires them together.
 * Nothing else in the game constructs services, so swapping an
 * implementation (another storage, a fake API in tests) happens here only.
 */
export function createServices({ adapter = createDefaultAdapter(), fetchImpl } = {}) {
  const events = new EventBus();

  const settingsStore = new JsonStore(adapter, 'settings', defaultSettings());
  const settings = settingsStore.load();

  const profileStore = new JsonStore(adapter, 'profile', defaultProfileData());
  const profile = new Profile(profileStore.load());
  if (!profile.data.installId) {
    profile.data.installId = newContentId('install');
    profileStore.save(profile.toJSON());
  }

  const library = new ContentLibrary({ store: new JsonStore(adapter, 'library', []), deletedStore: new JsonStore(adapter, 'library-deleted', {}) });
  const api = new ApiClient({ baseUrl: settings.serverUrl || DEFAULT_SERVER_URL, fetchImpl });
  const account = new AccountService({
    api, store: new JsonStore(adapter, 'account', { token: null, user: null, lastSyncedAt: null }), profile, profileStore, library, events,
  });
  const progression = new ProgressionService({ profile, store: profileStore, library, events });
  const sharing = new ShareService({ library, api, events, getAuthor: () => profile.data.playerName });

  const memorySink = new MemoryAnalyticsSink();
  const analytics = new Analytics({
    events,
    sinks: [memorySink, new RemoteAnalyticsSink({ api, installId: profile.data.installId, isEnabled: () => settings.shareAnalytics })],
  });

  // Progression reacts to sharing without either knowing about the other.
  events.on('content.shared', () => progression.recordShare());
  events.on('content.imported', ({ count }) => progression.recordImport(count));

  return {
    events,
    adapter,
    settings,
    saveSettings: (changes) => {
      Object.assign(settings, changes);
      settingsStore.save(settings);
      events.emit('settings.changed', settings);
    },
    profile,
    saveProfile: () => {
      profileStore.save(profile.toJSON());
      account.scheduleSync();
    },
    library,
    api,
    account,
    progression,
    sharing,
    analytics,
    memorySink,
    saveTransfer: new SaveTransfer({ adapter }),
  };
}
