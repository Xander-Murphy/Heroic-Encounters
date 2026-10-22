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
  }

  static async open({ filePath }) {
    const { DatabaseSync } = await import('node:sqlite');
    return new SqliteCommunityStore(new DatabaseSync(filePath));
  }

  async insertContent(entry) {
    this.db.prepare(`
      INSERT INTO content (code, hash, kind, title, author, description, share_string, item_count, item_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(entry.code, entry.hash, entry.kind, entry.title, entry.author, entry.description, entry.shareString, entry.itemCount, JSON.stringify(entry.itemIds ?? []), entry.createdAt);
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

  async close() {
    this.db.close();
  }
}
