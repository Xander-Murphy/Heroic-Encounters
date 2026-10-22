import { CommunityStore, REPORT_HIDE_THRESHOLD } from './CommunityStore.js';

const DUPLICATE_KEY = 11000;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Strip Mongo's _id and give the code back its usual name. */
const fromContent = (document) => {
  if (!document) return null;
  const { _id, ...entry } = document;
  return { code: _id, ...entry };
};

const fromUser = (document) => {
  if (!document) return null;
  const { _id, ...user } = document;
  return { id: _id, ...user };
};

/**
 * Community data in MongoDB (e.g. a free MongoDB Atlas cluster), for when
 * the server runs on a host without a persistent disk.
 *
 * The `mongodb` driver is an optional dependency, imported only when this
 * store is used, so playing locally still needs no `npm install`.
 *
 * Collections: content (_id = code), likes and reports (_id = code|voter),
 * installDays, eventCounts, heroUnlocks, users (_id = id), sessions
 * (_id = token hash) and saves (_id = user id; the save is stored as a JSON
 * string because its maps are keyed by ids and dates).
 */
export class MongoCommunityStore extends CommunityStore {
  constructor(client, db) {
    super();
    this.client = client;
    this.db = db;
    const collection = (name) => db.collection(name);
    this.content = collection('content');
    this.likes = collection('likes');
    this.reports = collection('reports');
    this.installDays = collection('installDays');
    this.eventCounts = collection('eventCounts');
    this.heroUnlocks = collection('heroUnlocks');
    this.users = collection('users');
    this.sessions = collection('sessions');
    this.saves = collection('saves');
  }

  static async open({ uri, dbName = 'heroic-encounters' }) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });
    await client.connect();
    const store = new MongoCommunityStore(client, client.db(dbName));
    await store.#createIndexes();
    return store;
  }

  async #createIndexes() {
    await Promise.all([
      this.content.createIndex({ hash: 1 }, { unique: true }),
      this.content.createIndex({ kind: 1, createdAt: -1 }),
      this.installDays.createIndex({ installId: 1, day: 1 }, { unique: true }),
      this.users.createIndex({ usernameKey: 1 }, { unique: true }),
      this.sessions.createIndex({ expiresAt: 1 }),
    ]);
  }

  async insertContent(entry) {
    const { code, ...rest } = entry;
    await this.content.insertOne({ _id: code, downloads: 0, likes: 0, reports: 0, ownerId: null, ...rest });
    return this.getByCode(code);
  }

  async findByHash(hash) {
    return fromContent(await this.content.findOne({ hash }));
  }

  async getByCode(code) {
    return fromContent(await this.content.findOne({ _id: code }));
  }

  async listContent({ kind, sort, q, limit, offset }) {
    const match = { reports: { $lt: REPORT_HIDE_THRESHOLD } };
    if (kind) match.kind = kind;
    if (q) {
      const pattern = new RegExp(escapeRegex(q), 'i');
      match.$or = [{ title: pattern }, { author: pattern }];
    }
    const order = sort === 'popular' ? { popularity: -1, createdAt: -1 } : { createdAt: -1 };
    const documents = await this.content.aggregate([
      { $match: match },
      { $addFields: { popularity: { $add: [{ $multiply: ['$likes', 3] }, '$downloads'] } } },
      { $sort: order },
      { $skip: offset },
      { $limit: limit },
      { $project: { popularity: 0 } },
    ]).toArray();
    return documents.map(fromContent);
  }

  async incrementDownloads(code) {
    await this.content.updateOne({ _id: code }, { $inc: { downloads: 1 } });
  }

  async addLike(code, installId) {
    const added = await insertOnce(this.likes, { _id: `${code}|${installId}` });
    if (added) await this.content.updateOne({ _id: code }, { $inc: { likes: 1 } });
    const entry = await this.content.findOne({ _id: code }, { projection: { likes: 1 } });
    return { likes: entry?.likes ?? 0, alreadyLiked: !added };
  }

  async addReport(code, installId) {
    const added = await insertOnce(this.reports, { _id: `${code}|${installId}` });
    if (added) await this.content.updateOne({ _id: code }, { $inc: { reports: 1 } });
    const entry = await this.content.findOne({ _id: code }, { projection: { reports: 1 } });
    return entry?.reports ?? 0;
  }

  async recordEvents(installId, day, events) {
    await this.installDays.updateOne({ installId, day }, { $setOnInsert: { installId, day } }, { upsert: true });
    const counts = {};
    let unlocks = 0;
    for (const event of events) {
      counts[event.name] = (counts[event.name] ?? 0) + 1;
      if (event.name === 'run.finished' && event.props?.reachedBoss) counts['run.reachedBoss'] = (counts['run.reachedBoss'] ?? 0) + 1;
      if (event.name === 'hero.unlocked') unlocks += 1;
    }
    const operations = Object.entries(counts).map(([name, count]) => ({
      updateOne: { filter: { _id: name }, update: { $inc: { count } }, upsert: true },
    }));
    if (operations.length) await this.eventCounts.bulkWrite(operations);
    if (unlocks) await this.heroUnlocks.updateOne({ _id: installId }, { $inc: { count: unlocks } }, { upsert: true });
  }

  async metricsSnapshot() {
    const installDays = new Map();
    for (const { installId, day } of await this.installDays.find().sort({ day: 1 }).toArray()) {
      if (!installDays.has(installId)) installDays.set(installId, []);
      installDays.get(installId).push(day);
    }
    const eventCounts = Object.fromEntries((await this.eventCounts.find().toArray()).map((row) => [row._id, row.count]));
    const heroUnlocks = new Map((await this.heroUnlocks.find().toArray()).map((row) => [row._id, row.count]));
    return { installDays, eventCounts, reachedBoss: eventCounts['run.reachedBoss'] ?? 0, heroUnlocks };
  }

  async createUser(user) {
    const { id, ...rest } = user;
    return await insertOnce(this.users, { _id: id, ...rest }) ? { ...user } : null;
  }

  async getUserByName(usernameKey) {
    return fromUser(await this.users.findOne({ usernameKey }));
  }

  async getUserById(id) {
    return fromUser(await this.users.findOne({ _id: id }));
  }

  async createSession(session) {
    const { tokenHash, ...rest } = session;
    await this.sessions.insertOne({ _id: tokenHash, ...rest });
  }

  async getSession(tokenHash) {
    const document = await this.sessions.findOne({ _id: tokenHash });
    if (!document) return null;
    const { _id, ...rest } = document;
    return { tokenHash: _id, ...rest };
  }

  async deleteSession(tokenHash) {
    await this.sessions.deleteOne({ _id: tokenHash });
  }

  async deleteExpiredSessions(nowIso) {
    await this.sessions.deleteMany({ expiresAt: { $lt: nowIso } });
  }

  async getSave(userId) {
    const document = await this.saves.findOne({ _id: userId });
    return document ? { data: JSON.parse(document.data), updatedAt: document.updatedAt } : null;
  }

  async putSave(userId, data, updatedAt) {
    await this.saves.updateOne({ _id: userId }, { $set: { data: JSON.stringify(data), updatedAt } }, { upsert: true });
  }

  async close() {
    await this.client.close();
  }
}

/** Insert, or return false if a document with the same unique key already exists. */
async function insertOnce(collection, document) {
  try {
    await collection.insertOne(document);
    return true;
  } catch (error) {
    if (error.code === DUPLICATE_KEY) return false;
    throw error;
  }
}
