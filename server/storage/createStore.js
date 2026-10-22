import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { MemoryCommunityStore } from './MemoryCommunityStore.js';
import { SqliteCommunityStore } from './SqliteCommunityStore.js';

/**
 * Pick a storage backend:
 *   - MongoDB when a connection string is given (hosting without a disk)
 *   - otherwise SQLite when available (Node 22.5+)
 *   - otherwise a JSON snapshot file.
 * `kind: 'memory'` keeps nothing on disk (tests).
 */
export async function createStore({ kind = 'auto', dataDir = 'data', mongoUri = '', mongoDbName } = {}) {
  if (kind === 'memory') return { store: await MemoryCommunityStore.open({}), kind: 'memory' };

  if (kind === 'mongo' || (kind === 'auto' && mongoUri)) {
    if (!mongoUri) throw new Error('STORAGE=mongo needs a MONGODB_URI connection string.');
    // Imported here so the driver is only needed by servers that use it.
    const { MongoCommunityStore } = await import('./MongoCommunityStore.js');
    return { store: await MongoCommunityStore.open({ uri: mongoUri, dbName: mongoDbName }), kind: 'mongo' };
  }

  await mkdir(dataDir, { recursive: true });
  if (kind === 'auto' || kind === 'sqlite') {
    try {
      return { store: await SqliteCommunityStore.open({ filePath: path.join(dataDir, 'community.db') }), kind: 'sqlite' };
    } catch (error) {
      if (kind === 'sqlite') throw error;
      console.warn(`SQLite unavailable (${error.message}); falling back to a JSON file.`);
    }
  }
  return { store: await MemoryCommunityStore.open({ filePath: path.join(dataDir, 'community.json') }), kind: 'json' };
}
