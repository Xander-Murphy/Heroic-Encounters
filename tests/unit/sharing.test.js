import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createBundle } from '../../web/js/sharing/bundle.js';
import { ShareCodec, ShareFormatError } from '../../web/js/sharing/ShareCodec.js';
import { ImportStatus, ShareService } from '../../web/js/sharing/ShareService.js';
import { heroDef, makeLibrary } from '../helpers.js';

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
