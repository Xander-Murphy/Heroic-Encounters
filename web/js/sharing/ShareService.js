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

  /** Publish to the community database. Returns { code }. */
  async publish(id, { description = '' } = {}) {
    if (!this.api?.available) throw new Error('The community server is not reachable right now.');
    const definition = this.library.get(id);
    const known = this.library.meta(id)?.publishedCode;
    if (known && this.library.meta(id)?.publishedHash === JSON.stringify(definition)) return { code: known, existing: true };
    const shareString = await this.codec.encode(createBundle({
      items: this.library.bundleFor([id]), title: definition.name, author: this.getAuthor(),
    }));
    const result = await this.api.publish({
      shareString, kind: definition.kind, title: definition.name, author: this.getAuthor(), description,
    });
    this.library.updateMeta(id, { publishedCode: result.code, publishedHash: JSON.stringify(definition) });
    this.events?.emit('content.shared', { ids: [id], method: 'publish', code: result.code });
    return result;
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
