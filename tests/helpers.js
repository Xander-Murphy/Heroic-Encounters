import { ContentFactory } from '../web/js/content/ContentFactory.js';
import { ContentLibrary } from '../web/js/content/ContentLibrary.js';
import { JsonStore, MemoryStorageAdapter } from '../web/js/persistence/storage.js';

export const factory = new ContentFactory();

const ability = (overrides) => ({
  name: 'Hit', description: '', power: 20, cooldown: 0, target: 'single_enemy', school: 'physical', priority: 0,
  effects: [{ type: 'damage' }], ...overrides,
});

export { ability };

/** A hero definition with sensible defaults; override anything. */
export function heroDef(overrides = {}) {
  return {
    id: overrides.id ?? `h-test-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'hero', name: 'Tester', className: 'Tester', role: 'damage', portrait: '🧪',
    health: 100, attack: 0, defense: 0, speed: 5, resistances: {}, basicAttackSchool: 'physical',
    abilities: [ability()], ...overrides,
  };
}

export function enemyDef(overrides = {}) {
  return {
    id: overrides.id ?? `e-test-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'enemy', name: 'Dummy', rank: 'minion', enemyType: 'physical', behavior: 'random', portrait: '🎯',
    health: 100, attack: 0, defense: 0, speed: 1, resistances: {}, basicAttackSchool: 'physical', phases: [],
    abilities: [ability()], ...overrides,
  };
}

export const makeHero = (overrides) => factory.createHero(heroDef(overrides));
export const makeEnemy = (overrides) => factory.createEnemy(enemyDef(overrides));

export function makeLibrary() {
  const adapter = new MemoryStorageAdapter();
  return { adapter, library: new ContentLibrary({ store: new JsonStore(adapter, 'library', []) }) };
}
