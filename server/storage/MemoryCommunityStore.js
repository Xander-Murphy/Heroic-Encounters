import { readFile, rename, writeFile } from 'node:fs/promises';

import { CommunityStore, popularity, REPORT_HIDE_THRESHOLD } from './CommunityStore.js';

/**
 * Keeps everything in memory. With a `filePath` it loads from and saves to
 * a JSON snapshot, which is enough for a small group of friends when the
 * built-in SQLite module isn't available.
 */
export class MemoryCommunityStore extends CommunityStore {
  constructor({ filePath = null } = {}) {
    super();
    this.filePath = filePath;
    this.content = new Map();
    this.likes = new Set(); // `${code}|${installId}`
    this.reports = new Set();
    this.installDays = new Map(); // installId -> Set(day)
    this.eventCounts = {};
    this.reachedBoss = 0;
    this.heroUnlocks = new Map();
    this.users = new Map(); // id -> user
    this.sessions = new Map(); // tokenHash -> session
    this.saves = new Map(); // userId -> { data, updatedAt }
    this.saveTimer = null;
  }

  static async open(options) {
    const store = new MemoryCommunityStore(options);
    if (store.filePath) await store.#load();
    return store;
  }

  async insertContent(entry) {
    const stored = { downloads: 0, likes: 0, reports: 0, ownerId: null, ...entry };
    this.content.set(stored.code, stored);
    this.#scheduleSave();
    return { ...stored };
  }

  async findByHash(hash) {
    const found = [...this.content.values()].find((entry) => entry.hash === hash);
    return found ? { ...found } : null;
  }

  async getByCode(code) {
    const found = this.content.get(code);
    return found ? { ...found } : null;
  }

  async listContent({ kind, sort, q, limit, offset }) {
    const needle = q?.toLowerCase();
    return [...this.content.values()]
      .filter((entry) => entry.reports < REPORT_HIDE_THRESHOLD)
      .filter((entry) => !kind || entry.kind === kind)
      .filter((entry) => !needle || entry.title.toLowerCase().includes(needle) || entry.author.toLowerCase().includes(needle))
      .sort((a, b) => (sort === 'popular' ? popularity(b) - popularity(a) : 0) || b.createdAt.localeCompare(a.createdAt))
      .slice(offset, offset + limit)
      .map((entry) => ({ ...entry }));
  }

  async incrementDownloads(code) {
    const entry = this.content.get(code);
    if (entry) {
      entry.downloads += 1;
      this.#scheduleSave();
    }
  }

  async addLike(code, installId) {
    const entry = this.content.get(code);
    const key = `${code}|${installId}`;
    if (!entry) return { likes: 0, alreadyLiked: false };
    if (this.likes.has(key)) return { likes: entry.likes, alreadyLiked: true };
    this.likes.add(key);
    entry.likes += 1;
    this.#scheduleSave();
    return { likes: entry.likes, alreadyLiked: false };
  }

  async addReport(code, installId) {
    const entry = this.content.get(code);
    const key = `${code}|${installId}`;
    if (!entry) return 0;
    if (!this.reports.has(key)) {
      this.reports.add(key);
      entry.reports += 1;
      this.#scheduleSave();
    }
    return entry.reports;
  }

  async recordEvents(installId, day, events) {
    if (!this.installDays.has(installId)) this.installDays.set(installId, new Set());
    this.installDays.get(installId).add(day);
    for (const event of events) {
      this.eventCounts[event.name] = (this.eventCounts[event.name] ?? 0) + 1;
      if (event.name === 'run.finished' && event.props?.reachedBoss) this.reachedBoss += 1;
      if (event.name === 'hero.unlocked') this.heroUnlocks.set(installId, (this.heroUnlocks.get(installId) ?? 0) + 1);
    }
    this.#scheduleSave();
  }

  async metricsSnapshot() {
    return {
      installDays: new Map([...this.installDays].map(([id, days]) => [id, [...days].sort()])),
      eventCounts: { ...this.eventCounts },
      reachedBoss: this.reachedBoss,
      heroUnlocks: new Map(this.heroUnlocks),
    };
  }

  async createUser(user) {
    if (await this.getUserByName(user.usernameKey)) return null;
    this.users.set(user.id, { ...user });
    this.#scheduleSave();
    return { ...user };
  }

  async getUserByName(usernameKey) {
    const found = [...this.users.values()].find((user) => user.usernameKey === usernameKey);
    return found ? { ...found } : null;
  }

  async getUserById(id) {
    const found = this.users.get(id);
    return found ? { ...found } : null;
  }

  async createSession(session) {
    this.sessions.set(session.tokenHash, { ...session });
    this.#scheduleSave();
  }

  async getSession(tokenHash) {
    const found = this.sessions.get(tokenHash);
    return found ? { ...found } : null;
  }

  async deleteSession(tokenHash) {
    if (this.sessions.delete(tokenHash)) this.#scheduleSave();
  }

  async deleteExpiredSessions(nowIso) {
    for (const [tokenHash, session] of this.sessions) {
      if (session.expiresAt < nowIso) this.sessions.delete(tokenHash);
    }
    this.#scheduleSave();
  }

  async getSave(userId) {
    const found = this.saves.get(userId);
    return found ? structuredClone(found) : null;
  }

  async putSave(userId, data, updatedAt) {
    this.saves.set(userId, structuredClone({ data, updatedAt }));
    this.#scheduleSave();
  }

  async close() {
    clearTimeout(this.saveTimer);
    await this.#save();
  }

  #scheduleSave() {
    if (!this.filePath || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.#save().catch((error) => console.error('Could not save community data:', error));
    }, 1000);
  }

  async #save() {
    if (!this.filePath) return;
    const snapshot = {
      content: [...this.content.values()],
      likes: [...this.likes],
      reports: [...this.reports],
      installDays: [...this.installDays].map(([id, days]) => [id, [...days]]),
      eventCounts: this.eventCounts,
      reachedBoss: this.reachedBoss,
      heroUnlocks: [...this.heroUnlocks],
      users: [...this.users.values()],
      sessions: [...this.sessions.values()],
      saves: [...this.saves],
    };
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(snapshot));
    await rename(temporary, this.filePath);
  }

  async #load() {
    const raw = await readFile(this.filePath, 'utf8').catch(() => null);
    if (!raw) return;
    const snapshot = JSON.parse(raw);
    snapshot.content?.forEach((entry) => this.content.set(entry.code, entry));
    this.likes = new Set(snapshot.likes ?? []);
    this.reports = new Set(snapshot.reports ?? []);
    this.installDays = new Map((snapshot.installDays ?? []).map(([id, days]) => [id, new Set(days)]));
    this.eventCounts = snapshot.eventCounts ?? {};
    this.reachedBoss = snapshot.reachedBoss ?? 0;
    this.heroUnlocks = new Map(snapshot.heroUnlocks ?? []);
    this.users = new Map((snapshot.users ?? []).map((user) => [user.id, user]));
    this.sessions = new Map((snapshot.sessions ?? []).map((session) => [session.tokenHash, session]));
    this.saves = new Map(snapshot.saves ?? []);
  }
}
