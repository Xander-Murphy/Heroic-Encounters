import { CommunityStore, REPORT_HIDE_THRESHOLD } from './CommunityStore.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS content (
    code TEXT PRIMARY KEY,
    hash TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    share_string TEXT NOT NULL,
    item_count INTEGER NOT NULL,
    item_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    downloads INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    reports INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS content_kind_created ON content (kind, created_at DESC);
  CREATE TABLE IF NOT EXISTS content_likes (code TEXT NOT NULL, install_id TEXT NOT NULL, PRIMARY KEY (code, install_id));
  CREATE TABLE IF NOT EXISTS content_reports (code TEXT NOT NULL, install_id TEXT NOT NULL, PRIMARY KEY (code, install_id));
  CREATE TABLE IF NOT EXISTS install_days (install_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (install_id, day));
  CREATE TABLE IF NOT EXISTS event_counts (name TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS hero_unlocks (install_id TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    username_key TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expires ON sessions (expires_at);
  CREATE TABLE IF NOT EXISTS saves (user_id TEXT PRIMARY KEY REFERENCES users (id), data TEXT NOT NULL, updated_at TEXT NOT NULL);
`;

const fromRow = (row) => row && ({
  code: row.code,
  hash: row.hash,
  kind: row.kind,
  title: row.title,
  author: row.author,
  description: row.description,
  shareString: row.share_string,
  itemCount: row.item_count,
  itemIds: JSON.parse(row.item_ids ?? '[]'),
  createdAt: row.created_at,
  downloads: row.downloads,
  likes: row.likes,
  reports: row.reports,
  ownerId: row.owner_id ?? null,
});

const userFromRow = (row) => row && ({
  id: row.id, username: row.username, usernameKey: row.username_key, passwordHash: row.password_hash, createdAt: row.created_at,
});

/** Community data in one SQLite file, using Node's built-in node:sqlite (no npm install). */
export class SqliteCommunityStore extends CommunityStore {
  constructor(database) {
    super();
    this.db = database;
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(SCHEMA);
    this.#migrate();
  }

  /** Bring databases created by older versions up to the current schema. */
  #migrate() {
    const columns = this.db.prepare('PRAGMA table_info(content)').all().map((column) => column.name);
    if (!columns.includes('item_ids')) this.db.exec("ALTER TABLE content ADD COLUMN item_ids TEXT NOT NULL DEFAULT '[]'");
    if (!columns.includes('owner_id')) this.db.exec('ALTER TABLE content ADD COLUMN owner_id TEXT');
  }

  static async open({ filePath }) {
    const { DatabaseSync } = await import('node:sqlite');
    return new SqliteCommunityStore(new DatabaseSync(filePath));
  }

  async insertContent(entry) {
    this.db.prepare(`
      INSERT INTO content (code, hash, kind, title, author, description, share_string, item_count, item_ids, created_at, owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(entry.code, entry.hash, entry.kind, entry.title, entry.author, entry.description, entry.shareString, entry.itemCount, JSON.stringify(entry.itemIds ?? []), entry.createdAt, entry.ownerId ?? null);
    return this.getByCode(entry.code);
  }

  async findByHash(hash) {
    return fromRow(this.db.prepare('SELECT * FROM content WHERE hash = ?').get(hash)) ?? null;
  }

  async getByCode(code) {
    return fromRow(this.db.prepare('SELECT * FROM content WHERE code = ?').get(code)) ?? null;
  }

  async listContent({ kind, sort, q, limit, offset }) {
    const where = ['reports < ?'];
    const params = [REPORT_HIDE_THRESHOLD];
    if (kind) {
      where.push('kind = ?');
      params.push(kind);
    }
    if (q) {
      where.push("(title LIKE ? ESCAPE '\\' OR author LIKE ? ESCAPE '\\')");
      const pattern = `%${q.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      params.push(pattern, pattern);
    }
    const order = sort === 'popular' ? '(likes * 3 + downloads) DESC, created_at DESC' : 'created_at DESC';
    const rows = this.db.prepare(`SELECT * FROM content WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);
    return rows.map(fromRow);
  }

  async incrementDownloads(code) {
    this.db.prepare('UPDATE content SET downloads = downloads + 1 WHERE code = ?').run(code);
  }

  async addLike(code, installId) {
    const inserted = this.db.prepare('INSERT OR IGNORE INTO content_likes (code, install_id) VALUES (?, ?)').run(code, installId);
    if (inserted.changes) this.db.prepare('UPDATE content SET likes = likes + 1 WHERE code = ?').run(code);
    const row = this.db.prepare('SELECT likes FROM content WHERE code = ?').get(code);
    return { likes: row?.likes ?? 0, alreadyLiked: !inserted.changes };
  }

  async addReport(code, installId) {
    const inserted = this.db.prepare('INSERT OR IGNORE INTO content_reports (code, install_id) VALUES (?, ?)').run(code, installId);
    if (inserted.changes) this.db.prepare('UPDATE content SET reports = reports + 1 WHERE code = ?').run(code);
    return this.db.prepare('SELECT reports FROM content WHERE code = ?').get(code)?.reports ?? 0;
  }

  async recordEvents(installId, day, events) {
    this.db.exec('BEGIN');
    try {
      this.db.prepare('INSERT OR IGNORE INTO install_days (install_id, day) VALUES (?, ?)').run(installId, day);
      const count = this.db.prepare('INSERT INTO event_counts (name, count) VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET count = count + 1');
      const unlock = this.db.prepare('INSERT INTO hero_unlocks (install_id, count) VALUES (?, 1) ON CONFLICT(install_id) DO UPDATE SET count = count + 1');
      for (const event of events) {
        count.run(event.name);
        if (event.name === 'run.finished' && event.props?.reachedBoss) count.run('run.reachedBoss');
        if (event.name === 'hero.unlocked') unlock.run(installId);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async metricsSnapshot() {
    const installDays = new Map();
    for (const row of this.db.prepare('SELECT install_id, day FROM install_days ORDER BY day').all()) {
      if (!installDays.has(row.install_id)) installDays.set(row.install_id, []);
      installDays.get(row.install_id).push(row.day);
    }
    const eventCounts = Object.fromEntries(this.db.prepare('SELECT name, count FROM event_counts').all().map((row) => [row.name, row.count]));
    const heroUnlocks = new Map(this.db.prepare('SELECT install_id, count FROM hero_unlocks').all().map((row) => [row.install_id, row.count]));
    return { installDays, eventCounts, reachedBoss: eventCounts['run.reachedBoss'] ?? 0, heroUnlocks };
  }

  async createUser(user) {
    const inserted = this.db.prepare('INSERT OR IGNORE INTO users (id, username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(user.id, user.username, user.usernameKey, user.passwordHash, user.createdAt);
    return inserted.changes ? this.getUserById(user.id) : null;
  }

  async getUserByName(usernameKey) {
    return userFromRow(this.db.prepare('SELECT * FROM users WHERE username_key = ?').get(usernameKey)) ?? null;
  }

  async getUserById(id) {
    return userFromRow(this.db.prepare('SELECT * FROM users WHERE id = ?').get(id)) ?? null;
  }

  async createSession(session) {
    this.db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(session.tokenHash, session.userId, session.createdAt, session.expiresAt);
  }

  async getSession(tokenHash) {
    const row = this.db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash);
    return row ? { tokenHash: row.token_hash, userId: row.user_id, createdAt: row.created_at, expiresAt: row.expires_at } : null;
  }

  async deleteSession(tokenHash) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  async deleteExpiredSessions(nowIso) {
    this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso);
  }

  async getSave(userId) {
    const row = this.db.prepare('SELECT data, updated_at FROM saves WHERE user_id = ?').get(userId);
    return row ? { data: JSON.parse(row.data), updatedAt: row.updated_at } : null;
  }

  async putSave(userId, data, updatedAt) {
    this.db.prepare('INSERT INTO saves (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
      .run(userId, JSON.stringify(data), updatedAt);
  }

  async close() {
    this.db.close();
  }
}
