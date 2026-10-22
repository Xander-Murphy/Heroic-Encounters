import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from './app.js';
import { createStore } from './storage/createStore.js';

/**
 * Heroic Encounters server: serves the game and hosts the community
 * database. No npm packages needed.
 *
 *   npm start                     → http://localhost:8080
 *   PORT=3000 npm start           → another port
 *   STORAGE=json npm start        → JSON file instead of SQLite
 *   DATA_DIR=/var/lib/he npm start
 *   MONGODB_URI=mongodb+srv://… npm start  → MongoDB (needs `npm install`; see docs/Hosting.md)
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = {
  port: Number(process.env.PORT ?? 8080),
  host: process.env.HOST ?? '0.0.0.0',
  storage: process.env.STORAGE ?? 'auto',
  dataDir: path.resolve(root, process.env.DATA_DIR ?? 'data'),
  mongoUri: process.env.MONGODB_URI ?? '',
  mongoDbName: process.env.MONGODB_DB || undefined,
  staticDir: path.join(root, 'web'),
};

const { store, kind } = await createStore({ ...config, kind: config.storage });
const server = http.createServer(createApp({ store, staticDir: config.staticDir, storageKind: kind }));

server.listen(config.port, config.host, () => {
  console.log(`Heroic Encounters is running at http://localhost:${config.port}  (community storage: ${kind})`);
});

const shutdown = async () => {
  server.close();
  await store.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
