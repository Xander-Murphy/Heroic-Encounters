import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CORE_DUNGEONS } from '../../web/js/content/core/dungeons.js';
import { CORE_ENEMIES } from '../../web/js/content/core/enemies.js';
import { CORE_HEROES } from '../../web/js/content/core/heroes.js';
import { PowerTier, ratePower } from '../../web/js/content/powerBudget.js';
import { validateDefinition } from '../../web/js/content/schema.js';
import { heroDef, makeLibrary } from '../helpers.js';

describe('Built-in content', () => {
  it('every hero, enemy and dungeon passes validation', () => {
    for (const definition of [...CORE_HEROES, ...CORE_ENEMIES, ...CORE_DUNGEONS]) {
      const { valid, errors } = validateDefinition(definition);
      assert.ok(valid, `${definition.id}: ${errors.join('; ')}`);
    }
  });

  it('dungeons only reference enemies that exist', () => {
    const { library } = makeLibrary();
    for (const dungeon of library.dungeons()) assert.deepEqual(library.missingDependencies(dungeon), []);
  });

  it('contains no Warcraft-specific names', () => {
    const text = JSON.stringify([CORE_HEROES, CORE_ENEMIES, CORE_DUNGEONS]).toLowerCase();
    for (const banned of ['warcraft', 'ragefire', 'deadmines', 'wailing caverns', 'vancleef', 'defias', 'taragaman', 'mutanus']) {
      assert.ok(!text.includes(banned), banned);
    }
  });

  it('built-in heroes are rated within a fair band', () => {
    for (const hero of CORE_HEROES) {
      const { tier } = ratePower(validateDefinition(hero).value);
      assert.ok([PowerTier.FAIR, PowerTier.STRONG].includes(tier), `${hero.name} is ${tier.label}`);
    }
  });
});

describe('Schema validation', () => {
  it('rejects out-of-range stats and unknown effect types', () => {
    const { valid, errors } = validateDefinition(heroDef({ health: 99999, abilities: [{ name: 'X', target: 'single_enemy', effects: [{ type: 'explode' }] }] }));
    assert.equal(valid, false);
    assert.ok(errors.some((error) => error.startsWith('health')));
    assert.ok(errors.some((error) => error.includes('effects[0].type')));
  });

  it('strips unknown fields, including prototype tricks', () => {
    const definition = JSON.parse(JSON.stringify(heroDef({ id: 'h-strip-test' })).replace('{', '{"__proto__":{"polluted":true},"evil":"<script>",'));
    const { valid, value } = validateDefinition(definition);
    assert.equal(valid, true);
    assert.equal(value.evil, undefined);
    assert.equal({}.polluted, undefined);
    assert.equal(Object.getPrototypeOf(value), Object.prototype);
  });

  it('requires immunity effects to name a school', () => {
    const { valid } = validateDefinition(heroDef({ abilities: [{ name: 'Shield', target: 'self', effects: [{ type: 'status', status: { name: 'Immune', type: 'immunity', duration: 1, schools: [] } }] }] }));
    assert.equal(valid, false);
  });

  it('normalized output validates again unchanged (round-trip safe)', () => {
    const { value } = validateDefinition(CORE_HEROES[0]);
    const again = validateDefinition(value);
    assert.equal(again.valid, true);
    assert.deepEqual(again.value, value);
  });
});

describe('ContentLibrary', () => {
  it('persists player content and refuses to replace built-ins', () => {
    const { adapter, library } = makeLibrary();
    assert.equal(library.save(heroDef({ id: 'core:koryne' })).ok, false);
    assert.equal(library.save(heroDef({ id: 'h-saved-one' })).ok, true);
    const { library: reloaded } = { library: new library.constructor({ store: library.store }) };
    assert.ok(reloaded.get('h-saved-one'));
    assert.ok(adapter.read('library').length === 1);
  });

  it('bundles a dungeon with the custom enemies it needs, but not built-ins', () => {
    const { library } = makeLibrary();
    library.save({ ...JSON.parse(JSON.stringify(CORE_ENEMIES[0])), id: 'e-custom-1', name: 'Custom' });
    library.save({ ...JSON.parse(JSON.stringify(CORE_DUNGEONS[0])), id: 'd-custom-1', waves: [{ enemies: ['e-custom-1', 'core:ashen_brute'], min: 1, max: 2 }] });
    assert.deepEqual(library.bundleFor(['d-custom-1']).map((item) => item.id).sort(), ['d-custom-1', 'e-custom-1']);
  });

  it('instantiates independent copies', () => {
    const { library } = makeLibrary();
    const a = library.instantiate('core:koryne');
    const b = library.instantiate('core:koryne');
    a.loseHealth(10);
    assert.equal(b.health, b.maxHealth);
  });
});
