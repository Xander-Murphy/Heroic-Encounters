import { createHash, randomBytes } from 'node:crypto';

import { HttpError } from '../http.js';

const SESSION_DAYS = 90;

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/**
 * Bearer-token sessions. The player's browser keeps a random token and sends
 * it as "Authorization: Bearer …"; the database only stores its SHA-256, so
 * a leaked database can't be used to sign in as anyone.
 *
 * Tokens rather than cookies because the game is often served from a
 * different origin than the server (a downloaded copy on localhost, GitHub
 * Pages), where cross-site cookies are unreliable.
 */
export class Authenticator {
  constructor({ store, now = () => new Date() }) {
    this.store = store;
    this.now = now;
  }

  /** Start a session for `userId`. Returns the token to give the client. */
  async issue(userId) {
    const token = randomBytes(32).toString('base64url');
    const now = this.now();
    await this.store.deleteExpiredSessions(now.toISOString());
    await this.store.createSession({
      tokenHash: hashToken(token),
      userId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString(),
    });
    return token;
  }

  /** The signed-in user for a request, or null (no token, unknown or expired). */
  async userFor(request) {
    const token = tokenOf(request);
    if (!token) return null;
    const session = await this.store.getSession(hashToken(token));
    if (!session || session.expiresAt < this.now().toISOString()) return null;
    return this.store.getUserById(session.userId);
  }

  /** Like userFor(), but answers 401 when nobody is signed in. */
  async requireUser(request) {
    const user = await this.userFor(request);
    if (!user) throw new HttpError(401, 'Please sign in again.');
    return user;
  }

  async revoke(request) {
    const token = tokenOf(request);
    if (token) await this.store.deleteSession(hashToken(token));
  }
}

function tokenOf(request) {
  const match = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(request.headers.authorization ?? '');
  return match?.[1] ?? null;
}
