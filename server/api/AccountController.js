import { randomUUID } from 'node:crypto';

import { mergeSaves } from '../../web/js/persistence/cloudSave.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../auth/passwords.js';
import { HttpError, readJson, sendJson } from '../http.js';

export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,24}$/;
export const PASSWORD_LENGTH = [8, 200];
const MAX_SAVE_BYTES = 2_000_000;

const publicUser = (user) => ({ id: user.id, username: user.username });

/**
 * Accounts and cloud saves.
 *
 *   POST /api/auth/register  { username, password } → { token, user }
 *   POST /api/auth/login     { username, password } → { token, user }
 *   POST /api/auth/logout
 *   GET  /api/auth/me        → { user }
 *   GET  /api/me/save        → { save, updatedAt }
 *   PUT  /api/me/save        { save } → { save, updatedAt }  (merged with what's stored)
 *
 * The server merges instead of overwriting, so two devices syncing at the
 * same time both keep everything they earned.
 */
export class AccountController {
  #saveLocks = new Map(); // userId -> promise of the save in progress

  constructor({ store, authenticator, rateLimiter }) {
    this.store = store;
    this.auth = authenticator;
    this.rateLimiter = rateLimiter;
  }

  register(router) {
    router.post('/api/auth/register', (context) => this.signUp(context));
    router.post('/api/auth/login', (context) => this.signIn(context));
    router.post('/api/auth/logout', (context) => this.signOut(context));
    router.get('/api/auth/me', (context) => this.me(context));
    router.get('/api/me/save', (context) => this.getSave(context));
    router.put('/api/me/save', (context) => this.putSave(context));
    return router;
  }

  async signUp({ request, response, ip }) {
    this.#limit(ip);
    const { username, password } = await this.#credentials(request);
    const user = await this.store.createUser({
      id: randomUUID(),
      username,
      usernameKey: username.toLowerCase(),
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    });
    if (!user) throw new HttpError(409, 'That username is taken.');
    sendJson(response, 201, { token: await this.auth.issue(user.id), user: publicUser(user) });
  }

  async signIn({ request, response, ip }) {
    this.#limit(ip);
    const { username, password } = await this.#credentials(request);
    const user = await this.store.getUserByName(username.toLowerCase());
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'Wrong username or password.');
    sendJson(response, 200, { token: await this.auth.issue(user.id), user: publicUser(user) });
  }

  async signOut({ request, response }) {
    await this.auth.revoke(request);
    sendJson(response, 200, { ok: true });
  }

  async me({ request, response }) {
    sendJson(response, 200, { user: publicUser(await this.auth.requireUser(request)) });
  }

  async getSave({ request, response }) {
    const user = await this.auth.requireUser(request);
    const stored = await this.store.getSave(user.id);
    sendJson(response, 200, { save: stored?.data ?? null, updatedAt: stored?.updatedAt ?? null });
  }

  async putSave({ request, response }) {
    const user = await this.auth.requireUser(request);
    const { save } = await readJson(request, MAX_SAVE_BYTES);
    if (!save || typeof save !== 'object') throw new HttpError(400, 'save is required.');
    const result = await this.#withSaveLock(user.id, async () => {
      const merged = mergeSaves((await this.store.getSave(user.id))?.data, save);
      const updatedAt = new Date().toISOString();
      await this.store.putSave(user.id, merged, updatedAt);
      return { save: merged, updatedAt };
    });
    sendJson(response, 200, result);
  }

  /** Run one read-merge-write per user at a time, so concurrent syncs can't overwrite each other. */
  async #withSaveLock(userId, task) {
    const previous = this.#saveLocks.get(userId) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(task);
    this.#saveLocks.set(userId, current);
    try {
      return await current;
    } finally {
      if (this.#saveLocks.get(userId) === current) this.#saveLocks.delete(userId);
    }
  }

  async #credentials(request) {
    const body = await readJson(request, 2000);
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!USERNAME_PATTERN.test(username)) throw new HttpError(400, 'Usernames are 3–24 letters, numbers, - or _.');
    if (password.length < PASSWORD_LENGTH[0] || password.length > PASSWORD_LENGTH[1]) {
      throw new HttpError(400, `Passwords need at least ${PASSWORD_LENGTH[0]} characters.`);
    }
    return { username, password };
  }

  #limit(ip) {
    if (this.rateLimiter && !this.rateLimiter.take(ip)) throw new HttpError(429, 'Too many attempts. Wait a minute and try again.');
  }
}
