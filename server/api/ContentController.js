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
 * back; look content up by code; browse, like and report. The account that
 * published an entry can update it (same code, likes and downloads) or remove it.
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
    router.get('/api/me/content', (context) => this.listMine(context));
    router.post('/api/content', (context) => this.publish(context));
    router.get('/api/content/:code', (context) => this.get(context));
    router.put('/api/content/:code', (context) => this.update(context));
    router.delete('/api/content/:code', (context) => this.remove(context));
    router.post('/api/content/:code/like', (context) => this.like(context));
    router.post('/api/content/:code/download', (context) => this.download(context));
    router.post('/api/content/:code/report', (context) => this.report(context));
    return router;
  }

  async publish({ request, response, ip }) {
    this.#limit(ip);
    const user = await this.authenticator?.userFor(request);
    if (!user) throw new HttpError(401, 'Sign in to publish to the community.');
    const body = await readJson(request, MAX_SHARE_LENGTH + 10_000);
    const upload = await this.#readUpload(body);
    const { shareString, bundle, hash } = upload;
    const kind = CONTENT_KINDS.includes(body.kind) ? body.kind : bundle.items[0].definition.kind;
    const existing = await this.store.findByHash(hash);
    if (existing) {
      sendJson(response, 200, { code: existing.code, existing: true });
      return;
    }

    // Already uploaded by this account, though the game no longer knows its code
    // (another device, or a save from before codes synced): update it, don't duplicate it.
    const mainId = bundle.items[0].definition.id;
    const previous = (await this.store.listOwnedBy(user.id)).find((entry) => entry.itemIds?.[0] === mainId);
    if (previous) {
      await this.#applyUpdate(previous, user, body, upload);
      sendJson(response, 200, { code: previous.code, updated: true });
      return;
    }

    const entry = await this.store.insertContent({
      code: await this.#newCode(),
      hash,
      kind,
      title: text(body.title, LIMITS.name) || bundle.title || bundle.items[0].name,
      // Uploads carry the account name, so nobody can publish as someone else.
      author: user.username,
      description: text(body.description, LIMITS.description),
      shareString,
      itemCount: bundle.items.length,
      itemIds: bundle.items.map((item) => item.definition.id),
      createdAt: new Date().toISOString(),
      ownerId: user.id,
    });
    sendJson(response, 201, { code: entry.code, existing: false });
  }

  /** Replace an entry's content. Its code, likes and downloads stay, so links and imports keep working. */
  async update({ request, response, params, ip }) {
    this.#limit(ip);
    const { user, entry } = await this.#ownedEntry(request, params.code);
    const body = await readJson(request, MAX_SHARE_LENGTH + 10_000);
    const upload = await this.#readUpload(body);
    if (upload.hash === entry.hash) {
      sendJson(response, 200, { code: entry.code, updated: false });
      return;
    }
    const duplicate = await this.store.findByHash(upload.hash);
    if (duplicate) throw new HttpError(409, `This exact content is already published as ${duplicate.code}.`);

    await this.#applyUpdate(entry, user, body, upload);
    sendJson(response, 200, { code: entry.code, updated: true });
  }

  async remove({ request, response, params, ip }) {
    this.#limit(ip);
    const { entry } = await this.#ownedEntry(request, params.code);
    await this.store.deleteContent(entry.code);
    sendJson(response, 200, { ok: true });
  }

  async get({ request, response, params }) {
    const entry = await this.store.getByCode(this.#code(params.code));
    if (!entry) throw new HttpError(404, 'No content was found with that code.');
    const user = await this.authenticator?.userFor(request);
    sendJson(response, 200, { ...this.#listing(entry, user), shareString: entry.shareString });
  }

  async list({ request, response, query }) {
    const kind = CONTENT_KINDS.includes(query.get('kind')) ? query.get('kind') : '';
    const sort = query.get('sort') === 'popular' ? 'popular' : 'recent';
    const limit = Math.min(50, Math.max(1, Number.parseInt(query.get('limit'), 10) || 30));
    const offset = Math.max(0, Number.parseInt(query.get('offset'), 10) || 0);
    const q = text(query.get('q') ?? '', 40);
    const entries = await this.store.listContent({ kind, sort, q, limit, offset });
    const user = await this.authenticator?.userFor(request);
    sendJson(response, 200, { items: entries.map((entry) => this.#listing(entry, user)) });
  }

  /** The signed-in account's uploads, newest first, so a device can recognize its own content. */
  async listMine({ request, response }) {
    const user = await this.authenticator?.userFor(request);
    if (!user) throw new HttpError(401, 'Sign in to see your uploads.');
    const entries = await this.store.listOwnedBy(user.id);
    sendJson(response, 200, { items: entries.map((entry) => ({ ...this.#listing(entry, user), shareString: entry.shareString })) });
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

  /** Decode and validate an upload. Anything malformed is refused here, for new entries and updates alike. */
  async #readUpload(body) {
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

    // Hash the validated content itself (not the string, which carries a timestamp),
    // so publishing the same thing twice returns the same code.
    const canonical = JSON.stringify(bundle.items.map((item) => item.definition).sort((a, b) => a.id.localeCompare(b.id)));
    return { shareString, bundle, hash: createHash('sha256').update(canonical).digest('hex') };
  }

  #applyUpdate(entry, user, body, { shareString, bundle, hash }) {
    return this.store.updateContent(entry.code, {
      hash,
      title: text(body.title, LIMITS.name) || bundle.title || bundle.items[0].name,
      author: user.username,
      description: text(body.description, LIMITS.description) || entry.description,
      shareString,
      itemCount: bundle.items.length,
      itemIds: bundle.items.map((item) => item.definition.id),
      updatedAt: new Date().toISOString(),
    });
  }

  /** The entry and signed-in user, if that user published it. Uploads from before accounts were required have no owner. */
  async #ownedEntry(request, rawCode) {
    const code = this.#code(rawCode);
    const user = await this.authenticator?.userFor(request);
    if (!user) throw new HttpError(401, 'Sign in to change your uploads.');
    const entry = await this.store.getByCode(code);
    if (!entry) throw new HttpError(404, 'No content was found with that code.');
    if (entry.ownerId !== user.id) throw new HttpError(403, 'Only the account that published this can change or remove it.');
    return { user, entry };
  }

  /** The public listing plus whether it belongs to the player asking (the owner's id itself stays private). */
  #listing(entry, user) {
    return { ...toListing(entry), mine: Boolean(user && entry.ownerId === user.id) };
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
