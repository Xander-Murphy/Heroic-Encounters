/**
 * Storage interface for the community server (Dependency Inversion).
 *
 * Controllers only talk to this interface. Two implementations ship:
 *   - SqliteCommunityStore (default; Node's built-in SQLite, a single file)
 *   - MemoryCommunityStore (fallback; optionally snapshotted to a JSON file)
 * A hosted database (Postgres, Supabase, ...) would be one more subclass.
 *
 * A content entry: { code, hash, kind, title, author, description,
 *   shareString, itemCount, itemIds, createdAt, downloads, likes, reports }
 */
export class CommunityStore {
  /** @returns {Promise<object>} the stored entry */
  async insertContent(_entry) { throw new Error('not implemented'); }

  async findByHash(_hash) { throw new Error('not implemented'); }

  async getByCode(_code) { throw new Error('not implemented'); }

  async codeExists(code) { return Boolean(await this.getByCode(code)); }

  /** @param {{ kind?: string, sort: 'recent'|'popular', q?: string, limit: number, offset: number }} query */
  async listContent(_query) { throw new Error('not implemented'); }

  async incrementDownloads(_code) { throw new Error('not implemented'); }

  /** @returns {Promise<{ likes: number, alreadyLiked: boolean }>} */
  async addLike(_code, _installId) { throw new Error('not implemented'); }

  /** @returns {Promise<number>} total reports */
  async addReport(_code, _installId) { throw new Error('not implemented'); }

  /** Record analytics events received from one install on `day` (YYYY-MM-DD). */
  async recordEvents(_installId, _day, _events) { throw new Error('not implemented'); }

  /**
   * Raw numbers for the metrics summary:
   * { installDays: Map<installId, string[]>, eventCounts: Record<name, number>,
   *   reachedBoss: number, heroUnlocks: Map<installId, number> }
   */
  async metricsSnapshot() { throw new Error('not implemented'); }

  async close() {}
}

/** Content hidden from browsing once this many players have reported it. */
export const REPORT_HIDE_THRESHOLD = 5;

export const popularity = (entry) => entry.likes * 3 + entry.downloads;

/** Shape returned by list/browse endpoints (never includes the share string). */
export function toListing(entry) {
  const { code, kind, title, author, description, itemCount, itemIds = [], createdAt, downloads, likes } = entry;
  return { code, kind, title, author, description, itemCount, itemIds, createdAt, downloads, likes };
}
