/**
 * Turns a bundle of content definitions into a compact, copy-pasteable
 * string and back.
 *
 *   HE1.<base64url(deflate-raw(JSON))>   compressed (normal)
 *   HE1u.<base64url(JSON)>               uncompressed fallback
 *
 * The version prefix lets future formats coexist with old strings.
 * Decoding only checks the envelope; ShareService validates the content.
 */

export const SHARE_PREFIX = 'HE1.';
export const SHARE_PREFIX_PLAIN = 'HE1u.';
export const MAX_SHARE_LENGTH = 200_000;
const MAX_JSON_BYTES = 1_000_000;

export class ShareFormatError extends Error {}

const hasCompression = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text) {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new ShareFormatError('The share string contains invalid characters.');
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipe(bytes, stream, limit = Infinity) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new ShareFormatError('The share string is too large.');
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export class ShareCodec {
  /** @param {object} payload  any JSON-serializable object */
  async encode(payload) {
    const json = new TextEncoder().encode(JSON.stringify(payload));
    if (!hasCompression()) return SHARE_PREFIX_PLAIN + bytesToBase64Url(json);
    const compressed = await pipe(json, new CompressionStream('deflate-raw'));
    return SHARE_PREFIX + bytesToBase64Url(compressed);
  }

  /** True if `text` looks like a share string (cheap check, no decoding). */
  isShareString(text) {
    const trimmed = String(text ?? '').trim();
    return trimmed.startsWith(SHARE_PREFIX) || trimmed.startsWith(SHARE_PREFIX_PLAIN);
  }

  async decode(text) {
    const trimmed = String(text ?? '').trim().replace(/\s+/g, '');
    if (trimmed.length > MAX_SHARE_LENGTH) throw new ShareFormatError('The share string is too long.');

    let json;
    try {
      if (trimmed.startsWith(SHARE_PREFIX)) {
        if (!hasCompression()) throw new ShareFormatError('This browser cannot read compressed share strings.');
        json = await pipe(base64UrlToBytes(trimmed.slice(SHARE_PREFIX.length)), new DecompressionStream('deflate-raw'), MAX_JSON_BYTES);
      } else if (trimmed.startsWith(SHARE_PREFIX_PLAIN)) {
        json = base64UrlToBytes(trimmed.slice(SHARE_PREFIX_PLAIN.length));
      } else {
        throw new ShareFormatError('That is not a Heroic Encounters share string (they start with "HE1.").');
      }
      return JSON.parse(new TextDecoder().decode(json));
    } catch (error) {
      if (error instanceof ShareFormatError) throw error;
      throw new ShareFormatError('The share string is damaged or incomplete. Try copying it again.');
    }
  }
}
