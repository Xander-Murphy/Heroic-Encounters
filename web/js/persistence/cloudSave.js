import { validateDefinition } from '../content/schema.js';

/**
 * The account save: the player's profile, their custom content and the ids
 * of content they deleted. Used by the server (which stores and merges saves
 * for accounts) and by the game (which builds and adopts them).
 *
 *   { version, profile, library: [{ definition, meta }], deleted: { id: timestamp } }
 *
 * sanitizeSave() keeps only known fields with sane values, like the content
 * schema does. mergeSaves() combines two saves so nothing earned on either
 * device is lost: counters take the larger value, collections are united,
 * and for content the most recent edit (or deletion) wins. Merging is
 * idempotent, so syncing the same save twice changes nothing.
 */
export const CLOUD_SAVE_VERSION = 1;

const MAX_MAP_KEYS = 2000;
const MAX_LIBRARY = 500;
const MAX_DELETED = 1000;
const KEEP_DAYS = 60;
const ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,63}$/i;
const STAT_PATTERN = /^[a-z][a-z0-9]{0,31}$/i;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SOURCES = ['created', 'imported'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (value) => (Number.isFinite(value) && value > 0 ? Math.min(Math.round(value), 1e12) : 0);
const timestamp = (value) => (Number.isFinite(value) && value > 0 ? Math.round(value) : 0);
const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
const optionalText = (value, max) => (typeof value === 'string' && value ? value.slice(0, max) : null);

/** { key: value } with keys matching `pattern` and values passed through `clean` (dropped when it returns undefined). */
function cleanMap(raw, pattern, clean) {
  const result = {};
  if (!isObject(raw)) return result;
  for (const [key, value] of Object.entries(raw).slice(0, MAX_MAP_KEYS)) {
    if (!pattern.test(key)) continue;
    const cleaned = clean(value);
    if (cleaned !== undefined) result[key] = cleaned;
  }
  return result;
}

const lastDays = (keys) => [...new Set(keys)].sort().slice(-KEEP_DAYS);

export function emptySave() {
  return { version: CLOUD_SAVE_VERSION, profile: sanitizeProfile({}), library: [], deleted: {} };
}

/** Everything in a profile except the per-browser installId. */
export function sanitizeProfile(raw) {
  const profile = isObject(raw) ? raw : {};
  const daily = isObject(profile.daily) ? profile.daily : {};
  return {
    playerName: text(profile.playerName, 32),
    playerNameAt: timestamp(profile.playerNameAt),
    renown: count(profile.renown),
    achievements: cleanMap(profile.achievements, ID_PATTERN, (value) => timestamp(value) || undefined),
    heroStats: cleanMap(profile.heroStats, ID_PATTERN, (value) => (isObject(value) ? { runs: count(value.runs), wins: count(value.wins) } : undefined)),
    dungeonStats: cleanMap(profile.dungeonStats, ID_PATTERN, (value) => (isObject(value)
      ? { runs: count(value.runs), wins: count(value.wins), bestRounds: count(value.bestRounds) || null }
      : undefined)),
    codex: cleanMap(profile.codex, ID_PATTERN, (value) => count(value) || undefined),
    stats: cleanMap(profile.stats, STAT_PATTERN, count),
    daily: {
      wins: Object.fromEntries(lastDays(Object.keys(cleanMap(daily.wins, DATE_KEY_PATTERN, (value) => (value ? true : undefined)))).map((key) => [key, true])),
      streak: count(daily.streak),
      best: count(daily.best),
      lastWinKey: DATE_KEY_PATTERN.test(daily.lastWinKey ?? '') ? daily.lastWinKey : null,
    },
    playDays: lastDays(Array.isArray(profile.playDays) ? profile.playDays.filter((key) => DATE_KEY_PATTERN.test(key ?? '')) : []),
    seenHeroes: [...new Set(Array.isArray(profile.seenHeroes) ? profile.seenHeroes.filter((id) => ID_PATTERN.test(id ?? '')) : [])].slice(0, MAX_MAP_KEYS),
  };
}

function sanitizeMeta(raw) {
  const meta = isObject(raw) ? raw : {};
  const origin = isObject(meta.origin)
    ? { author: text(meta.origin.author, 32), code: optionalText(meta.origin.code, 9), importedAt: timestamp(meta.origin.importedAt) }
    : null;
  return {
    source: SOURCES.includes(meta.source) ? meta.source : 'created',
    createdAt: timestamp(meta.createdAt),
    updatedAt: timestamp(meta.updatedAt),
    origin,
    publishedCode: optionalText(meta.publishedCode, 9),
    publishedHash: optionalText(meta.publishedHash, 50_000),
  };
}

/** Validated library entries, one per id (the most recently updated wins). */
function sanitizeLibrary(raw) {
  const byId = new Map();
  for (const entry of Array.isArray(raw) ? raw.slice(0, MAX_LIBRARY * 2) : []) {
    const { valid, value } = validateDefinition(entry?.definition);
    if (!valid) continue;
    const candidate = { definition: value, meta: sanitizeMeta(entry.meta) };
    const existing = byId.get(value.id);
    if (!existing || candidate.meta.updatedAt > existing.meta.updatedAt) byId.set(value.id, candidate);
  }
  return [...byId.values()].slice(0, MAX_LIBRARY);
}

function newestDeletions(deleted) {
  return Object.fromEntries(Object.entries(deleted).sort((a, b) => b[1] - a[1]).slice(0, MAX_DELETED));
}

export function sanitizeSave(raw) {
  const save = isObject(raw) ? raw : {};
  return {
    version: CLOUD_SAVE_VERSION,
    profile: sanitizeProfile(save.profile),
    library: sanitizeLibrary(save.library),
    deleted: newestDeletions(cleanMap(save.deleted, ID_PATTERN, (value) => timestamp(value) || undefined)),
  };
}

// --- Merging ------------------------------------------------------------------

function mergeMaps(a, b, combine) {
  const result = { ...a };
  for (const [key, value] of Object.entries(b)) result[key] = key in result ? combine(result[key], value) : value;
  return result;
}

const minPositive = (a, b) => (a && b ? Math.min(a, b) : a || b || null);

function mergeDaily(a, b) {
  // The streak belongs to whichever device won a daily most recently.
  const latest = (b.lastWinKey ?? '') > (a.lastWinKey ?? '') ? b : a;
  const streak = a.lastWinKey === b.lastWinKey ? Math.max(a.streak, b.streak) : latest.streak;
  return {
    wins: Object.fromEntries(lastDays([...Object.keys(a.wins), ...Object.keys(b.wins)]).map((key) => [key, true])),
    streak,
    best: Math.max(a.best, b.best, streak),
    lastWinKey: latest.lastWinKey,
  };
}

function mergeProfiles(a, b) {
  const nameFrom = b.playerNameAt > a.playerNameAt || (b.playerNameAt === a.playerNameAt && b.playerName) ? b : a;
  return {
    playerName: nameFrom.playerName,
    playerNameAt: nameFrom.playerNameAt,
    renown: Math.max(a.renown, b.renown),
    achievements: mergeMaps(a.achievements, b.achievements, Math.min),
    heroStats: mergeMaps(a.heroStats, b.heroStats, (x, y) => ({ runs: Math.max(x.runs, y.runs), wins: Math.max(x.wins, y.wins) })),
    dungeonStats: mergeMaps(a.dungeonStats, b.dungeonStats, (x, y) => ({
      runs: Math.max(x.runs, y.runs), wins: Math.max(x.wins, y.wins), bestRounds: minPositive(x.bestRounds, y.bestRounds),
    })),
    codex: mergeMaps(a.codex, b.codex, Math.max),
    stats: mergeMaps(a.stats, b.stats, Math.max),
    daily: mergeDaily(a.daily, b.daily),
    playDays: lastDays([...a.playDays, ...b.playDays]),
    seenHeroes: [...new Set([...a.seenHeroes, ...b.seenHeroes])],
  };
}

function mergeLibraries(a, b, deleted) {
  const byId = new Map();
  for (const entry of [...a, ...b]) {
    const existing = byId.get(entry.definition.id);
    if (!existing || entry.meta.updatedAt > existing.meta.updatedAt) byId.set(entry.definition.id, entry);
  }
  // A deletion beats any edit made before it; an edit after it brings the content back.
  return [...byId.values()].filter((entry) => !(deleted[entry.definition.id] >= entry.meta.updatedAt)).slice(0, MAX_LIBRARY);
}

/** Combine the stored save with an incoming one. Both are sanitized first. */
export function mergeSaves(stored, incoming) {
  const a = sanitizeSave(stored);
  const b = sanitizeSave(incoming);
  const deleted = newestDeletions(mergeMaps(a.deleted, b.deleted, Math.max));
  const library = mergeLibraries(a.library, b.library, deleted);
  // Content that exists again doesn't need its old deletion record.
  for (const entry of library) delete deleted[entry.definition.id];
  return { version: CLOUD_SAVE_VERSION, profile: mergeProfiles(a.profile, b.profile), library, deleted };
}
