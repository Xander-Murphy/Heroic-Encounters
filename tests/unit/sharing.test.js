import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createBundle } from '../../web/js/sharing/bundle.js';
import { ShareCodec, ShareFormatError } from '../../web/js/sharing/ShareCodec.js';
import { CannotUpdateError, ImportStatus, PublishState, ShareService } from '../../web/js/sharing/ShareService.js';
import { enemyDef, heroDef, makeLibrary } from '../helpers.js';

const codec = new ShareCodec();

describe('ShareCodec', () => {
  it('round-trips a payload through a compact string', async () => {
    const payload = { hello: 'world', list: [1, 2, 3], emoji: '🐉' };
    const text = await codec.encode(payload);
    assert.match(text, /^HE1\.[A-Za-z0-9_-]+$/);
    assert.deepEqual(await codec.decode(text), payload);
  });

  it('rejects damaged and foreign strings with a friendly error', async () => {
    const text = await codec.encode({ a: 1 });
    await assert.rejects(codec.decode(text.slice(0, -6)), ShareFormatError);
    await assert.rejects(codec.decode('hello'), ShareFormatError);
    await assert.rejects(codec.decode('HE1.%%%'), ShareFormatError);
  });
});

describe('ShareService', () => {
  const setup = () => {
    const alice = makeLibrary().library;
    const bob = makeLibrary().library;
    return { alice, bob, aliceShare: new ShareService({ library: alice, getAuthor: () => 'Alice' }), bobShare: new ShareService({ library: bob }) };
  };

  it('exports from one player and imports into another', async () => {
    const { alice, bob, aliceShare, bobShare } = setup();
    alice.save(heroDef({ id: 'h-shared-1', name: 'Pip' }));
    const text = await aliceShare.exportString(['h-shared-1']);
    const preview = await bobShare.preview(text);
    assert.equal(preview.author, 'Alice');
    assert.equal(preview.items[0].status, ImportStatus.NEW);
    const report = bobShare.importPreview(preview);
    assert.deepEqual(report.added, ['Pip']);
    assert.equal(bob.meta('h-shared-1').source, 'imported');
  });

  it('never overwrites built-ins or the player\'s own creations', async () => {
    const { bob, bobShare } = setup();
    bob.save(heroDef({ id: 'h-mine', name: 'Mine' }));
    const payload = createBundle({ items: [heroDef({ id: 'h-mine', name: 'Impostor' }), heroDef({ id: 'core:koryne' })] });
    const preview = await bobShare.preview(await codec.encode(payload));
    assert.deepEqual(preview.items.map((item) => item.status), [ImportStatus.BLOCKED, ImportStatus.BLOCKED]);
    bobShare.importPreview(preview);
    assert.equal(bob.get('h-mine').name, 'Mine');
  });

  it('marks invalid items and skips them', async () => {
    const { bobShare } = setup();
    const preview = await bobShare.preview(await codec.encode(createBundle({ items: [heroDef({ id: 'h-bad', health: -5 })] })));
    assert.equal(preview.items[0].status, ImportStatus.INVALID);
    assert.deepEqual(bobShare.importPreview(preview).skipped, ['Tester']);
  });

  it('recognizes links, raw strings and community codes', async () => {
    const { aliceShare } = setup();
    assert.equal(aliceShare.parseInput('https://game.example/#import=HE1.abc').type, 'string');
    assert.deepEqual(aliceShare.parseInput(' k7f2qx9p '), { type: 'code', value: 'K7F2-QX9P' });
    assert.equal(aliceShare.parseInput('nonsense'), null);
  });

  it('refuses to export built-in content', async () => {
    const { aliceShare } = setup();
    await assert.rejects(aliceShare.exportString(['core:koryne']));
  });
});

describe('ShareService publishing', () => {
  const failure = (status) => Object.assign(new Error(`failed with ${status}`), { status });

  const setup = (overrides = {}) => {
    const { library } = makeLibrary();
    const calls = { publish: [], update: [], remove: [] };
    const api = {
      available: true,
      publish: async (upload) => { calls.publish.push(upload); return { code: `NEW${calls.publish.length}-CODE` }; },
      updateContent: async (code, upload) => { calls.update.push({ code, ...upload }); return { code, updated: true }; },
      deleteContent: async (code) => { calls.remove.push(code); return { ok: true }; },
      ...overrides,
    };
    const hero = heroDef({ id: 'h-publish-1', name: 'Pip' });
    library.save(hero);
    return { library, calls, hero, sharing: new ShareService({ library, api }) };
  };

  it('updates the same entry after an edit instead of publishing a new one', async () => {
    const { library, calls, hero, sharing } = setup();
    assert.equal(sharing.publishState(hero.id), PublishState.NOT_PUBLISHED);
    const { code } = await sharing.publish(hero.id);
    assert.equal(sharing.publishState(hero.id), PublishState.CURRENT);

    assert.equal((await sharing.publish(hero.id)).existing, true);
    assert.equal(calls.update.length, 0, 'nothing to send when nothing changed');

    library.save({ ...hero, name: 'Pip the Second' });
    assert.equal(sharing.publishState(hero.id), PublishState.CHANGED);
    const result = await sharing.publish(hero.id);
    assert.equal(result.updated, true);
    assert.equal(result.code, code);
    assert.equal(calls.publish.length, 1);
    assert.equal(calls.update[0].code, code);
    assert.equal(library.meta(hero.id).publishedCode, code);
    assert.equal(sharing.publishState(hero.id), PublishState.CURRENT);
  });

  it('does not count an update found by the server as a new share', async () => {
    const shared = [];
    const { library } = makeLibrary();
    library.save(heroDef({ id: 'h-lost-2' }));
    const sharing = new ShareService({
      library,
      api: { available: true, publish: async () => ({ code: 'OLDE-CODE', updated: true }) },
      events: { emit: (name) => shared.push(name) },
    });
    assert.equal((await sharing.publish('h-lost-2')).updated, true);
    assert.equal(library.meta('h-lost-2').publishedCode, 'OLDE-CODE');
    assert.deepEqual(shared, []);
  });

  describe('reconnecting uploads', () => {
    const uploadOf = async (definition, code) => ({
      code, itemIds: [definition.id], shareString: await codec.encode(createBundle({ items: [definition], title: definition.name })),
    });

    it('links an edited hero that lost its code to its newest upload', async () => {
      const { library, hero, sharing } = setup();
      const items = [await uploadOf({ ...hero, name: 'Newer' }, 'NEWR-CODE'), await uploadOf({ ...hero, name: 'Older' }, 'OLDR-CODE')];
      sharing.api.myContent = async () => ({ items });
      library.save({ ...hero, name: 'Edited Since' });

      assert.equal(await sharing.reconnectUploads(), 1);
      assert.equal(library.meta(hero.id).publishedCode, 'NEWR-CODE');
      assert.equal(sharing.publishState(hero.id), PublishState.CHANGED);
    });

    it('does not claim there are changes when the hero matches its upload', async () => {
      const { library, hero, sharing } = setup();
      const items = [await uploadOf(library.get(hero.id), 'SAME-CODE')];
      sharing.api.myContent = async () => ({ items });
      await sharing.reconnectUploads();
      assert.equal(sharing.publishState(hero.id), PublishState.CURRENT);
    });

    it('leaves known codes, imported content and unrelated uploads alone', async () => {
      const { library, hero, sharing } = setup();
      await sharing.publish(hero.id);
      const known = library.meta(hero.id).publishedCode;
      const imported = heroDef({ id: 'h-imported-1' });
      library.save(imported, { source: 'imported' });
      const items = [await uploadOf(hero, 'OTHR-CODE'), await uploadOf(imported, 'IMPT-CODE'), await uploadOf(heroDef({ id: 'h-deleted-1' }), 'GONE-CODE')];
      sharing.api.myContent = async () => ({ items });

      assert.equal(await sharing.reconnectUploads(), 0);
      assert.equal(library.meta(hero.id).publishedCode, known);
      assert.equal(library.meta(imported.id).publishedCode, null);
    });
  });

  it('notices when a custom enemy bundled with a dungeon changes', async () => {
    const { library, sharing } = setup();
    const enemy = enemyDef({ id: 'e-bundled-1', name: 'Bundled' });
    library.save(enemy);
    const dungeon = {
      id: 'd-bundled-1', kind: 'dungeon', name: 'Lair', description: '', icon: '🏰', difficulty: 1,
      waves: [{ enemies: [enemy.id], count: [1, 1] }], boss: enemy.id, scaling: 0, restHeal: 0,
    };
    assert.deepEqual(library.save(dungeon).errors, []);
    await sharing.publish(dungeon.id);
    assert.equal(sharing.publishState(dungeon.id), PublishState.CURRENT);
    library.save({ ...enemy, name: 'Renamed' });
    assert.equal(sharing.publishState(dungeon.id), PublishState.CHANGED);
  });

  it('offers a new entry when the upload belongs to no one or someone else', async () => {
    const { library, calls, hero, sharing } = setup({ updateContent: async () => { throw failure(403); } });
    const { code } = await sharing.publish(hero.id);
    library.save({ ...hero, name: 'Edited' });

    await assert.rejects(sharing.publish(hero.id), CannotUpdateError);
    assert.equal(calls.publish.length, 1, 'never publishes a duplicate on its own');
    assert.equal(library.meta(hero.id).publishedCode, code);

    const copy = await sharing.publish(hero.id, { asNew: true });
    assert.notEqual(copy.code, code);
    assert.equal(library.meta(hero.id).publishedCode, copy.code);
  });

  it('passes on a sign-in failure without offering a new entry', async () => {
    const { library, calls, hero, sharing } = setup({ updateContent: async () => { throw failure(401); } });
    await sharing.publish(hero.id);
    library.save({ ...hero, name: 'Edited' });
    await assert.rejects(sharing.publish(hero.id), (error) => !(error instanceof CannotUpdateError) && error.status === 401);
    assert.equal(calls.publish.length, 1);
  });

  it('publishes again if the entry was removed from the server', async () => {
    const { library, hero, sharing } = setup({ updateContent: async () => { throw failure(404); } });
    await sharing.publish(hero.id);
    library.save({ ...hero, name: 'Back Again' });
    assert.equal((await sharing.publish(hero.id)).code, 'NEW2-CODE');
  });

  it('passes on other update failures without publishing', async () => {
    const { library, calls, hero, sharing } = setup({ updateContent: async () => { throw failure(500); } });
    await sharing.publish(hero.id);
    library.save({ ...hero, name: 'Edited' });
    await assert.rejects(sharing.publish(hero.id), /failed with 500/);
    assert.equal(calls.publish.length, 1);
  });

  it('forgets the code when unpublished, keeping the local copy', async () => {
    const { library, calls, hero, sharing } = setup();
    const { code } = await sharing.publish(hero.id);
    await sharing.unpublish(code);
    assert.deepEqual(calls.remove, [code]);
    assert.ok(library.has(hero.id));
    assert.equal(sharing.publishState(hero.id), PublishState.NOT_PUBLISHED);
  });

  it('treats an entry that is already gone as removed, but keeps the code on other failures', async () => {
    const gone = setup({ deleteContent: async () => { throw failure(404); } });
    await gone.sharing.unpublish((await gone.sharing.publish(gone.hero.id)).code);
    assert.equal(gone.sharing.publishState(gone.hero.id), PublishState.NOT_PUBLISHED);

    const refused = setup({ deleteContent: async () => { throw failure(403); } });
    const { code } = await refused.sharing.publish(refused.hero.id);
    await assert.rejects(refused.sharing.unpublish(code));
    assert.equal(refused.library.meta(refused.hero.id).publishedCode, code);
  });
});
