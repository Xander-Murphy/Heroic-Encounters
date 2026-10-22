/**
 * Key/value storage behind a small interface, so the rest of the game never
 * touches localStorage directly (Dependency Inversion). Everything the player
 * imports or earns lives here, which is what lets the game run locally with
 * no server once loaded.
 */
export class StorageAdapter {
  read(_key) {
    throw new Error('read() not implemented');
  }

  write(_key, _value) {
    throw new Error('write() not implemented');
  }

  remove(_key) {
    throw new Error('remove() not implemented');
  }

  keys() {
    return [];
  }
}

/** In-memory storage: used by tests and as a fallback when the browser blocks storage. */
export class MemoryStorageAdapter extends StorageAdapter {
  #data = new Map();

  read(key) {
    return this.#data.has(key) ? structuredClone(this.#data.get(key)) : null;
  }

  write(key, value) {
    this.#data.set(key, structuredClone(value));
    return true;
  }

  remove(key) {
    this.#data.delete(key);
  }

  keys() {
    return [...this.#data.keys()];
  }
}

/** localStorage with a namespace, JSON encoding and graceful failure (private mode, quota). */
export class LocalStorageAdapter extends StorageAdapter {
  constructor(namespace = 'heroic-encounters:v1:', backend = globalThis.localStorage) {
    super();
    this.namespace = namespace;
    this.backend = backend;
  }

  static isAvailable() {
    try {
      const probe = '__he_probe__';
      globalThis.localStorage.setItem(probe, '1');
      globalThis.localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  read(key) {
    try {
      const raw = this.backend.getItem(this.namespace + key);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  }

  write(key, value) {
    try {
      this.backend.setItem(this.namespace + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key) {
    try {
      this.backend.removeItem(this.namespace + key);
    } catch {
      // nothing to do: storage is unavailable
    }
  }

  keys() {
    try {
      return Object.keys(this.backend)
        .filter((key) => key.startsWith(this.namespace))
        .map((key) => key.slice(this.namespace.length));
    } catch {
      return [];
    }
  }
}

/** One JSON document under one key, with defaults. */
export class JsonStore {
  constructor(adapter, key, defaults) {
    this.adapter = adapter;
    this.key = key;
    this.defaults = defaults;
  }

  load() {
    const value = this.adapter.read(this.key);
    if (value === null) return structuredClone(this.defaults);
    if (Array.isArray(this.defaults)) return Array.isArray(value) ? value : structuredClone(this.defaults);
    return { ...structuredClone(this.defaults), ...value };
  }

  save(value) {
    return this.adapter.write(this.key, value);
  }

  clear() {
    this.adapter.remove(this.key);
  }
}

export function createDefaultAdapter() {
  return LocalStorageAdapter.isAvailable() ? new LocalStorageAdapter() : new MemoryStorageAdapter();
}
