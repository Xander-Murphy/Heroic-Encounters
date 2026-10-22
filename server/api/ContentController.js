import { createHash, randomInt } from 'node:crypto';

import { CONTENT_KINDS, LIMITS } from '../../web/js/content/schema.js';
import { readBundle } from '../../web/js/sharing/bundle.js';
import { MAX_SHARE_LENGTH, ShareCodec, ShareFormatError } from '../../web/js/sharing/ShareCodec.js';
import { COMMUNITY_CODE_PATTERN, normalizeCode } from '../../web/js/sharing/ShareService.js';
import { HttpError, readJson, sendJson } from '../http.js';
import { toListing } from '../storage/CommunityStore.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INSTALL_ID_PATTERN = /^[a-z0-9-]{6,64}$/i;

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/**
 * The community content database: publish a share string, get a short code
 * back; look content up by code; browse, like and report.
 *
 * Uploads are decoded and validated with the *same* schema module the game
 * uses, so nothing malformed is ever stored or handed to other players.
 */
export class ContentController {
  constructor({ store, rateLimiter, authenticator = null, codec = new ShareCodec() }) {
    this.store = store;
    this.rateLimiter = rateLimiter;
    this.authenticator = authenticator;
    this.codec = codec;
  }

  register(router) {
    router.get('/api/content', (context) => this.list(context));
    router.post('/api/content', (context) => this.publish(context));
    router.get('/api/content/:code', (context) => this.get(context));
    router.post('/api/content/:code/like', (context) => this.like(context));
    router.post('/api/content/:code/download', (context) => this.download(context));
    router.post('/api/content/:code/report', (context) => this.report(context));
    return router;
  }

  async publish({ request, response, ip }) {
    this.#limit(ip);
    const user = await this.authenticator?.userFor(request);
    const body = await readJson(request, MAX_SHARE_LENGTH + 10_000);
    const shareString = text(body.shareString, MAX_SHARE_LENGTH);
    if (!shareString) throw new HttpError(400, 'shareString is required.');

    let bundle;
    try {
      bundle = readBundle(await this.codec.decode(shareString));
    } catch (error) {
      throw new HttpError(400, error instanceof ShareFormatError ? error.message : 'Could not read the share string.');
    }
    const invalid = bundle.items.filter((item) => !item.valid);
    if (bundle.errors.length || invalid.length) {
      throw new HttpError(422, [...bundle.errors, ...invalid.flatMap((item) => item.errors.map((error) => `${item.name}: ${error}`))].slice(0, 10).join(' | '));
    }

    const kind = CONTENT_KINDS.includes(body.kind) ? body.kind : bundle.items[0].definition.kind;
    // Hash the validated content itself (not the string, which carries a timestamp),
    // so publishing the same thing twice returns the same code.
    const canonical = JSON.stringify(bundle.items.map((item) => item.definition).sort((a, b) => a.id.localeCompare(b.id)));
    const hash = createHash('sha256').update(canonical).digest('hex');
    const existing = await this.store.findByHash(hash);
    if (existing) {
      sendJson(response, 200, { code: existing.code, existing: true });
      return;
    }

    const entry = await this.store.insertContent({
      code: await this.#newCode(),
      hash,
      kind,
      title: text(body.title, LIMITS.name) || bundle.title || bundle.items[0].name,
      // Signed-in uploads carry the account name, so nobody can publish as someone else.
      author: user?.username ?? (text(body.author, LIMITS.name) || bundle.author),
      description: text(body.description, LIMITS.description),
      shareString,
      itemCount: bundle.items.length,
      itemIds: bundle.items.map((item) => item.definition.id),
      createdAt: new Date().toISOString(),
      ownerId: user?.id ?? null,
    });
    sendJson(response, 201, { code: entry.code, existing: false });
  }

  async get({ response, params }) {
    const entry = await this.store.getByCode(this.#code(params.code));
    if (!entry) throw new HttpError(404, 'No content was found with that code.');
    sendJson(response, 200, { ...toListing(entry), shareString: entry.shareString });
  }

  async list({ response, query }) {
    const kind = CONTENT_KINDS.includes(query.get('kind')) ? query.get('kind') : '';
    const sort = query.get('sort') === 'popular' ? 'popular' : 'recent';
    const limit = Math.min(50, Math.max(1, Number.parseInt(query.get('limit'), 10) || 30));
    const offset = Math.max(0, Number.parseInt(query.get('offset'), 10) || 0);
    const q = text(query.get('q') ?? '', 40);
    const entries = await this.store.listContent({ kind, sort, q, limit, offset });
    sendJson(response, 200, { items: entries.map(toListing) });
  }

  async like({ request, response, params, ip }) {
    this.#limit(ip);
    const voter = await this.#voter(request);
    const code = this.#code(params.code);
    if (!await this.store.getByCode(code)) throw new HttpError(404, 'No content was found with that code.');
    sendJson(response, 200, await this.store.addLike(code, voter));
  }

  async download({ response, params, ip }) {
    this.#limit(ip);
    await this.store.incrementDownloads(this.#code(params.code));
    sendJson(response, 200, { ok: true });
  }

  async report({ request, response, params, ip }) {
    this.#limit(ip);
    const voter = await this.#voter(request);
    const reports = await this.store.addReport(this.#code(params.code), voter);
    sendJson(response, 200, { ok: true, reports });
  }

  /** Who a like or report counts for: the account when signed in (one per person), else the install. */
  async #voter(request) {
    const user = await this.authenticator?.userFor(request);
    const { installId } = await readJson(request, 2000);
    if (user) return `user:${user.id}`;
    if (!INSTALL_ID_PATTERN.test(installId ?? '')) throw new HttpError(400, 'installId is required.');
    return installId;
  }

  #code(raw) {
    if (!COMMUNITY_CODE_PATTERN.test(raw ?? '')) throw new HttpError(400, 'That is not a valid community code.');
    return normalizeCode(raw);
  }

  async #newCode() {
    for (let attempt = 0; attempt < 20; attempt++) {
      const raw = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
      const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
      if (!await this.store.codeExists(code)) return code;
    }
    throw new HttpError(500, 'Could not allocate a code. Please try again.');
  }

  #limit(ip) {
    if (this.rateLimiter && !this.rateLimiter.take(ip)) throw new HttpError(429, 'Too many requests. Slow down a little.');
  }
}
