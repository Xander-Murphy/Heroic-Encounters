import { ContentSource } from '../content/ContentLibrary.js';
import { createBundle, readBundle } from './bundle.js';
import { ShareCodec, ShareFormatError } from './ShareCodec.js';

/** Community short codes look like "K7F2-QX9P" (no 0/O/1/I to avoid typos). */
export const COMMUNITY_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}-?[A-HJ-NP-Z2-9]{4}$/i;

export const normalizeCode = (code) => {
  const compact = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${compact.slice(0, 4)}-${compact.slice(4, 8)}`;
};

export const ImportStatus = Object.freeze({
  NEW: 'new',
  UPDATE: 'update',
  INVALID: 'invalid',
  BLOCKED: 'blocked',
});

/** How a published item compares with the player's copy. */
export const PublishState = Object.freeze({
  NOT_PUBLISHED: 'not-published',
  CURRENT: 'current',
  CHANGED: 'changed',
});

/** The published copy can't be updated from here, but the changes could still go up as a new entry. */
export class CannotUpdateError extends Error {}

/**
 * Everything to do with moving content between players:
 * share strings, share links, community codes, previews and imports.
 *
 * Collaborators are injected (library, codec, community API, event bus), so
 * the service works offline (no API) and in tests (fakes).
 */
export class ShareService {
  constructor({ library, codec = new ShareCodec(), api = null, events = null, getAuthor = () => '' }) {
    this.library = library;
    this.codec = codec;
    this.api = api;
    this.events = events;
    this.getAuthor = getAuthor;
  }

  /** Share string for some content ids (custom dependencies are bundled automatically). */
  async exportString(ids, { title } = {}) {
    const items = this.library.bundleFor(ids);
    if (!items.length) throw new Error('Only your own or imported content can be shared — built-in content is already in everyone\'s game.');
    const first = items.find((item) => ids.includes(item.id)) ?? items[0];
    const author = this.getAuthor();
    const text = await this.codec.encode(createBundle({ items, title: title ?? first.name, author }));
    this.events?.emit('content.shared', { ids, method: 'string', count: items.length });
    return text;
  }

  /** A link that opens the game and offers to import. */
  async exportLink(ids, baseUrl) {
    const text = await this.exportString(ids);
    return `${baseUrl.split('#')[0]}#import=${text}`;
  }

  /** Whether `id` is on the community database, and if so whether the player has changed it since. */
  publishState(id) {
    const meta = this.library.meta(id);
    if (!meta?.publishedCode) return PublishState.NOT_PUBLISHED;
    return meta.publishedHash === this.#fingerprint(id) ? PublishState.CURRENT : PublishState.CHANGED;
  }

  /**
   * Publish to the community database, or update the entry if `id` is already
   * there (same code, likes and downloads). Returns { code, existing?, updated? }.
   * Needs a signed-in account. Throws CannotUpdateError if the entry belongs to
   * no one or someone else; pass `asNew` to publish the changes separately instead.
   */
  async publish(id, { description = '', asNew = false } = {}) {
    if (!this.api?.available) throw new Error('The community server is not reachable right now.');
    const definition = this.library.get(id);
    const known = this.library.meta(id)?.publishedCode;
    if (this.publishState(id) === PublishState.CURRENT) return { code: known, existing: true };
    const shareString = await this.codec.encode(createBundle({
      items: this.library.bundleFor([id]), title: definition.name, author: this.getAuthor(),
    }));
    const upload = { shareString, title: definition.name, author: this.getAuthor(), description };
    const fingerprint = this.#fingerprint(id);

    if (known && !asNew) {
      try {
        await this.api.updateContent(known, upload);
        this.library.updateMeta(id, { publishedHash: fingerprint });
        return { code: known, updated: true };
      } catch (error) {
        if (error.status === 403) throw new CannotUpdateError('This upload isn\'t on your account, so it can\'t be updated. You can publish your changes as a new entry.');
        // 404: it was removed from the community, so publish it again below.
        if (error.status !== 404) throw error;
      }
    }

    const result = await this.api.publish({ ...upload, kind: definition.kind });
    this.library.updateMeta(id, { publishedCode: result.code, publishedHash: fingerprint });
    if (!result.updated) this.events?.emit('content.shared', { ids: [id], method: 'publish', code: result.code });
    return result;
  }

  /** Remove an entry from the community database. Copies other players imported stay with them. */
  async unpublish(code) {
    if (!this.api?.available) throw new Error('The community server is not reachable right now.');
    try {
      await this.api.deleteContent(code);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    for (const { definition, meta } of this.library.customEntries()) {
      if (meta.publishedCode === code) this.library.updateMeta(definition.id, { publishedCode: null, publishedHash: null });
    }
  }

  /**
   * Link the player's own creations back to uploads the account already has,
   * for content that lost its code (an older version of the game could erase
   * it, or the upload came from elsewhere). Returns how many were reconnected.
   */
  async reconnectUploads() {
    if (!this.api?.available) return 0;
    const { items } = await this.api.myContent();
    let reconnected = 0;
    for (const entry of items) { // newest first, so duplicates resolve to the latest upload
      const id = entry.itemIds?.[0];
      const meta = this.library.meta(id);
      if (meta?.source !== ContentSource.CREATED || meta.publishedCode) continue;
      const unchanged = await this.#matchesUpload(id, entry.shareString);
      this.library.updateMeta(id, { publishedCode: entry.code, publishedHash: unchanged ? this.#fingerprint(id) : null });
      reconnected += 1;
    }
    return reconnected;
  }

  async #matchesUpload(id, shareString) {
    try {
      const { items } = readBundle(await this.codec.decode(shareString));
      const uploaded = items.map((item) => item.definition);
      return JSON.stringify(uploaded.length === 1 ? uploaded[0] : uploaded) === this.#fingerprint(id);
    } catch {
      return false;
    }
  }

  /** What was uploaded for `id`, including custom enemies a dungeon bundles, to spot later edits. */
  #fingerprint(id) {
    const items = this.library.bundleFor([id]);
    return JSON.stringify(items.length === 1 ? items[0] : items);
  }

  /**
   * Work out what the player pasted.
   * @returns {{ type: 'string' | 'code', value: string } | null}
   */
  parseInput(input) {
    let text = String(input ?? '').trim();
    const hash = text.match(/[#?&](?:import|code)=([^&\s]+)/);
    if (hash) text = decodeURIComponent(hash[1]);
    if (this.codec.isShareString(text)) return { type: 'string', value: text };
    if (COMMUNITY_CODE_PATTERN.test(text)) return { type: 'code', value: normalizeCode(text) };
    return null;
  }

  /**
   * Decode and check pasted input without changing anything.
   * @returns preview { title, author, code, items: [{ definition, status, errors, name }], errors }
   */
  async preview(input) {
    const parsed = this.parseInput(input);
    if (!parsed) {
      return { items: [], errors: ['Paste a share string (starts with "HE1.") or a community code like K7F2-QX9P.'] };
    }

    let shareString = parsed.value;
    let code = null;
    try {
      if (parsed.type === 'code') {
        if (!this.api?.available) return { items: [], errors: ['Community codes need the community server, which is not reachable right now.'] };
        const entry = await this.api.fetchByCode(parsed.value);
        shareString = entry.shareString;
        code = parsed.value;
      }
      const bundle = readBundle(await this.codec.decode(shareString));
      return { ...bundle, code, items: bundle.items.map((item) => ({ ...item, status: this.#statusOf(item) })) };
    } catch (error) {
      const message = error instanceof ShareFormatError ? error.message : (error.message || 'Something went wrong reading that.');
      return { items: [], errors: [message] };
    }
  }

  /**
   * Save every importable item from a preview.
   * @returns {{ added: string[], updated: string[], skipped: string[] }}
   */
  importPreview(preview) {
    const report = { added: [], updated: [], skipped: [] };
    for (const item of preview.items) {
      if (item.status === ImportStatus.INVALID || item.status === ImportStatus.BLOCKED) {
        report.skipped.push(item.name);
        continue;
      }
      const result = this.library.save(item.definition, {
        source: ContentSource.IMPORTED,
        origin: { author: preview.author || item.definition.author || '', code: preview.code ?? null, importedAt: Date.now() },
      });
      if (!result.ok) report.skipped.push(item.name);
      else (result.replaced ? report.updated : report.added).push(item.definition.name);
    }
    if (report.added.length || report.updated.length) {
      this.events?.emit('content.imported', { count: report.added.length + report.updated.length, code: preview.code });
      if (preview.code) this.api?.recordDownload?.(preview.code);
    }
    return report;
  }

  #statusOf(item) {
    if (!item.valid) return ImportStatus.INVALID;
    if (this.library.isCore(item.definition.id)) return ImportStatus.BLOCKED;
    if (this.library.has(item.definition.id)) {
      // Never let an import silently overwrite the player's own creations.
      return this.library.meta(item.definition.id)?.source === ContentSource.CREATED ? ImportStatus.BLOCKED : ImportStatus.UPDATE;
    }
    return ImportStatus.NEW;
  }
}
