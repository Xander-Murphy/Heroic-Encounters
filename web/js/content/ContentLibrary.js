import { ContentFactory } from './ContentFactory.js';
import { CORE_DUNGEONS } from './core/dungeons.js';
import { CORE_ENEMIES } from './core/enemies.js';
import { CORE_HEROES } from './core/heroes.js';
import { validateDefinition } from './schema.js';

export const ContentSource = Object.freeze({
  CORE: 'core',
  CREATED: 'created',
  IMPORTED: 'imported',
});

/** Random id for player-made content, e.g. "h-k3j9x0q2ma". */
export function newContentId(kind) {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  const bytes = new Uint8Array(10);
  (globalThis.crypto ?? { getRandomValues: (array) => array.map(() => Math.random() * 256) }).getRandomValues(bytes);
  return `${kind[0]}-${[...bytes].map((byte) => alphabet[byte % 36]).join('')}`;
}

/**
 * Every hero, enemy and dungeon the player can use: the built-in set plus
 * anything they made or imported.
 *
 * Built-in content is read-only. Player content is validated on the way in
 * and persisted through an injected store ({ load(), save(entries) }), so the
 * library doesn't care whether that is localStorage, IndexedDB or memory.
 * Listeners are notified after every change (Observer).
 */
export class ContentLibrary {
  #entries = new Map(); // id -> { definition, meta }
  #prototypes = new Map(); // id -> engine object (built lazily, cloned on use)
  #listeners = new Set();

  constructor({ store = null, factory = new ContentFactory() } = {}) {
    this.store = store;
    this.factory = factory;
    for (const definition of [...CORE_HEROES, ...CORE_ENEMIES, ...CORE_DUNGEONS]) {
      const { valid, errors, value } = validateDefinition(definition);
      if (!valid) throw new Error(`Built-in content ${definition.id} is invalid: ${errors.join('; ')}`);
      this.#entries.set(value.id, { definition: { ...value, unlock: definition.unlock }, meta: { source: ContentSource.CORE } });
    }
    this.#loadCustom();
  }

  // --- Queries -------------------------------------------------------------

  get(id) {
    return this.#entries.get(id)?.definition ?? null;
  }

  meta(id) {
    return this.#entries.get(id)?.meta ?? null;
  }

  has(id) {
    return this.#entries.has(id);
  }

  isCore(id) {
    return this.meta(id)?.source === ContentSource.CORE;
  }

  /** Definitions of one kind, optionally filtered by source. */
  list(kind, { source = null } = {}) {
    return [...this.#entries.values()]
      .filter((entry) => entry.definition.kind === kind && (!source || entry.meta.source === source))
      .map((entry) => entry.definition);
  }

  heroes(options) {
    return this.list('hero', options);
  }

  enemies(options) {
    return this.list('enemy', options);
  }

  dungeons(options) {
    return this.list('dungeon', options);
  }

  customEntries() {
    return [...this.#entries.values()].filter((entry) => entry.meta.source !== ContentSource.CORE);
  }

  /** Ids a definition needs in order to work (a dungeon's enemies and boss). */
  dependenciesOf(definition) {
    if (definition?.kind !== 'dungeon') return [];
    return [...new Set([...definition.waves.flatMap((wave) => wave.enemies), definition.boss])];
  }

  missingDependencies(definition) {
    return this.dependenciesOf(definition).filter((id) => !this.has(id));
  }

  isPlayable(definition) {
    return this.missingDependencies(definition).length === 0;
  }

  /**
   * Everything needed to share `ids`: the definitions themselves plus any
   * player-made content they depend on (built-in content travels by id).
   */
  bundleFor(ids) {
    const collected = new Map();
    const visit = (id) => {
      if (collected.has(id) || this.isCore(id)) return;
      const definition = this.get(id);
      if (!definition) return;
      collected.set(id, definition);
      this.dependenciesOf(definition).forEach(visit);
    };
    ids.forEach(visit);
    return [...collected.values()];
  }

  // --- Building engine objects --------------------------------------------

  /** A fresh, independent engine object for `id` (Prototype: build once, clone per use). */
  instantiate(id) {
    const definition = this.get(id);
    if (!definition) return null;
    if (!this.#prototypes.has(id)) this.#prototypes.set(id, this.factory.createCharacter(definition));
    return this.#prototypes.get(id).clone();
  }

  /** Function handed to DungeonRun so it can spawn enemies without knowing about the library. */
  get enemyFactory() {
    return (id) => this.instantiate(id);
  }

  // --- Changes -------------------------------------------------------------

  /**
   * Validate and add (or replace) a player-made definition.
   * @returns {{ ok: boolean, errors: string[], definition?: object, replaced?: boolean }}
   */
  save(definition, meta = {}) {
    const { valid, errors, value } = validateDefinition(definition);
    if (!valid) return { ok: false, errors };
    if (this.isCore(value.id)) return { ok: false, errors: ['Built-in content cannot be replaced.'] };

    const previous = this.#entries.get(value.id);
    this.#entries.set(value.id, {
      definition: value,
      meta: {
        source: meta.source ?? previous?.meta.source ?? ContentSource.CREATED,
        createdAt: previous?.meta.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        origin: meta.origin ?? previous?.meta.origin ?? null,
        publishedCode: meta.publishedCode ?? previous?.meta.publishedCode ?? null,
        publishedHash: meta.publishedHash ?? previous?.meta.publishedHash ?? null,
      },
    });
    this.#prototypes.delete(value.id);
    this.#persist();
    return { ok: true, errors: [], definition: value, replaced: Boolean(previous) };
  }

  updateMeta(id, changes) {
    const entry = this.#entries.get(id);
    if (!entry || entry.meta.source === ContentSource.CORE) return;
    entry.meta = { ...entry.meta, ...changes };
    this.#persist();
  }

  remove(id) {
    if (this.isCore(id) || !this.#entries.delete(id)) return false;
    this.#prototypes.delete(id);
    this.#persist();
    return true;
  }

  /** Content that depends on `id` (e.g. dungeons using a custom enemy). */
  dependents(id) {
    return [...this.#entries.values()]
      .map((entry) => entry.definition)
      .filter((definition) => this.dependenciesOf(definition).includes(id));
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // --- Persistence ---------------------------------------------------------

  #loadCustom() {
    const saved = this.store?.load() ?? [];
    for (const entry of saved) {
      const { valid, value } = validateDefinition(entry?.definition);
      if (valid && !this.isCore(value.id)) this.#entries.set(value.id, { definition: value, meta: { ...entry.meta } });
    }
  }

  #persist() {
    this.store?.save(this.customEntries());
    this.#listeners.forEach((listener) => listener(this));
  }
}
