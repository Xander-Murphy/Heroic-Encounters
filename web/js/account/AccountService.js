import { mergeSaves, sanitizeSave } from '../persistence/cloudSave.js';
import { Profile } from '../progression/Profile.js';

/** Gameplay events after which progress is worth syncing. */
const SYNC_EVENTS = ['run.finished', 'achievement.unlocked', 'level.up', 'content.created', 'content.shared', 'content.imported'];

/** JSON with object keys sorted, so saves that differ only in key order compare equal. */
const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};

const comparable = (save) => stable({ ...save, library: [...save.library].sort((a, b) => a.definition.id.localeCompare(b.definition.id)) });

/**
 * The player's optional account: sign up, sign in, and keep this browser's
 * progress and content in sync with the account's cloud save.
 *
 * The game stays local-first: everything is saved in the browser as before,
 * and a sync shortly after changes sends it to the server, which merges it
 * with what other devices sent. The answer is merged again with anything
 * that changed locally while the request was in flight, so nothing is lost.
 *
 * Emits 'account.changed' (signed in/out), 'account.synced' ({ changed })
 * and 'account.syncFailed' ({ message, expired }).
 */
export class AccountService {
  #timer = null;
  #inFlight = null;
  #again = false;
  #applying = false;

  constructor({ api, store, profile, profileStore, library, events, debounceMs = 3000 }) {
    this.api = api;
    this.store = store;
    this.profile = profile;
    this.profileStore = profileStore;
    this.library = library;
    this.events = events;
    this.debounceMs = debounceMs;
    this.state = store.load(); // { token, user: { id, username }, lastSyncedAt }
    this.api.token = this.state.token;

    library.subscribe(() => this.scheduleSync());
    SYNC_EVENTS.forEach((name) => events.on(name, () => this.scheduleSync()));
  }

  get user() {
    return this.state.token ? this.state.user : null;
  }

  get lastSyncedAt() {
    return this.state.lastSyncedAt;
  }

  async register(username, password) {
    return this.#begin(await this.api.register(username, password));
  }

  async login(username, password) {
    return this.#begin(await this.api.login(username, password));
  }

  /** Sign out. Progress already in this browser stays here. */
  async logout() {
    clearTimeout(this.#timer);
    await this.flush();
    await this.api.logout().catch(() => null);
    this.#end();
  }

  /** Sync a little later, so a burst of changes becomes one request. */
  scheduleSync() {
    if (this.#applying || !this.user) return;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => { this.sync(); }, this.debounceMs);
  }

  /** Sync now if a sync is waiting (e.g. the page is being hidden). */
  async flush() {
    if (!this.#timer) return this.#inFlight;
    clearTimeout(this.#timer);
    return this.sync();
  }

  /** Send local progress, adopt the merged result. Resolves to true on success. */
  async sync() {
    clearTimeout(this.#timer);
    this.#timer = null;
    if (!this.user || !this.api.available) return false;
    if (this.#inFlight) {
      this.#again = true;
      return this.#inFlight;
    }
    this.#inFlight = this.#syncOnce().finally(() => { this.#inFlight = null; });
    const ok = await this.#inFlight;
    if (this.#again) {
      this.#again = false;
      return this.sync();
    }
    return ok;
  }

  /** What this browser has, in cloud-save form. */
  localSave() {
    return { profile: this.profile.toJSON(), library: this.library.customEntries(), deleted: this.library.deletions() };
  }

  async #syncOnce() {
    try {
      const { save, updatedAt } = await this.api.syncSave(this.localSave());
      const changed = this.#adopt(save);
      this.state.lastSyncedAt = updatedAt;
      this.store.save(this.state);
      this.events.emit('account.synced', { changed });
      return true;
    } catch (error) {
      const expired = error.status === 401;
      if (expired) this.#end();
      this.events.emit('account.syncFailed', { message: error.message, expired });
      return false;
    }
  }

  /** Merge the server's save into this browser. Returns true if anything here changed. */
  #adopt(serverSave) {
    const local = sanitizeSave(this.localSave());
    const merged = mergeSaves(serverSave, local);
    // Local changes made while the request was in flight still need to reach the server.
    if (comparable(merged) !== comparable(sanitizeSave(serverSave))) this.#again = true;
    if (comparable(merged) === comparable(local)) return false;

    this.#applying = true;
    try {
      this.profile.data = new Profile({ ...this.profile.data, ...merged.profile, installId: this.profile.data.installId }).data;
      this.profileStore.save(this.profile.toJSON());
      this.library.replaceCustom(merged.library, merged.deleted);
    } finally {
      this.#applying = false;
    }
    return true;
  }

  async #begin({ token, user }) {
    this.state = { token, user, lastSyncedAt: null };
    this.store.save(this.state);
    this.api.token = token;
    // Use the account name as the creator name if there isn't one yet (without
    // a timestamp, so a name already saved on the account wins).
    if (!this.profile.data.playerName) {
      this.profile.data.playerName = user.username;
      this.profileStore.save(this.profile.toJSON());
    }
    this.events.emit('account.changed', { user });
    await this.sync();
    return user;
  }

  #end() {
    clearTimeout(this.#timer);
    this.#timer = null;
    this.state = { token: null, user: null, lastSyncedAt: null };
    this.store.save(this.state);
    this.api.token = null;
    this.events.emit('account.changed', { user: null });
  }
}
