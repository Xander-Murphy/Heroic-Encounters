import { LIMITS, SCHEMA_VERSION, validateDefinition } from '../content/schema.js';

export const BUNDLE_FORMAT = 'heroic-encounters/bundle';
export const MAX_BUNDLE_ITEMS = 40;

/** The JSON payload inside every share string and community upload. */
export function createBundle({ items, title = '', author = '' }) {
  return {
    format: BUNDLE_FORMAT,
    version: SCHEMA_VERSION,
    title: String(title).slice(0, LIMITS.name),
    author: String(author).slice(0, LIMITS.name),
    createdAt: new Date().toISOString(),
    items,
  };
}

/**
 * Check a decoded payload and every definition in it.
 * @returns {{ title, author, items: { definition, valid, errors }[], errors: string[] }}
 */
export function readBundle(payload) {
  const errors = [];
  if (payload?.format !== BUNDLE_FORMAT) errors.push('This is not a Heroic Encounters bundle.');
  if (typeof payload?.version !== 'number' || payload.version > SCHEMA_VERSION) {
    errors.push('This was made with a newer version of the game. Refresh the page to update.');
  }
  const rawItems = Array.isArray(payload?.items) ? payload.items : [];
  if (!rawItems.length) errors.push('The bundle is empty.');
  if (rawItems.length > MAX_BUNDLE_ITEMS) errors.push(`A bundle can hold at most ${MAX_BUNDLE_ITEMS} items.`);

  const items = errors.length ? [] : rawItems.map((raw) => {
    const { valid, errors: itemErrors, value } = validateDefinition(raw);
    return { definition: value, valid, errors: itemErrors, name: value?.name || raw?.name || 'Unnamed' };
  });

  return {
    title: typeof payload?.title === 'string' ? payload.title.slice(0, LIMITS.name) : '',
    author: typeof payload?.author === 'string' ? payload.author.slice(0, LIMITS.name) : '',
    items,
    errors,
  };
}
