import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AccountService } from '../../web/js/account/AccountService.js';
import { EventBus } from '../../web/js/EventBus.js';
import { mergeSaves, sanitizeSave } from '../../web/js/persistence/cloudSave.js';
import { JsonStore } from '../../web/js/persistence/storage.js';
import { Profile } from '../../web/js/progression/Profile.js';
import { heroDef, makeLibrary } from '../helpers.js';

const entry = (definition, updatedAt) => ({ definition, meta: { source: 'created', createdAt: 1, updatedAt } });

describe('cloud save merge', () => {
  it('keeps the best of both devices', () => {
    const a = { profile: {
      renown: 500, achievements: { first: 200 }, stats: { runsWon: 3, created: 1 }, codex: { goblin: 2 },
      dungeonStats: { d1: { runs: 4, wins: 2, bestRounds: 9 } }, playDays: ['2026-10-01'],
      daily: { wins: { '2026-10-01': true }, streak: 1, best: 3, lastWinKey: '2026-10-01' },
    } };
    const b = { profile: {
      renown: 300, achievements: { first: 100, second: 300 }, stats: { runsWon: 1, shared: 2 }, codex: { goblin: 1, wolf: 1 },
      dungeonStats: { d1: { runs: 2, wins: 2, bestRounds: 7 } }, playDays: ['2026-10-02'],
      daily: { wins: { '2026-10-02': true }, streak: 2, best: 2, lastWinKey: '2026-10-02' },
    } };
    const { profile } = mergeSaves(a, b);
    assert.equal(profile.renown, 500);
    assert.deepEqual(profile.achievements, { first: 100, second: 300 });
    assert.deepEqual(profile.stats, { runsWon: 3, created: 1, shared: 2 });
    assert.deepEqual(profile.codex, { goblin: 2, wolf: 1 });
    assert.deepEqual(profile.dungeonStats.d1, { runs: 4, wins: 2, bestRounds: 7 });
    assert.deepEqual(profile.playDays, ['2026-10-01', '2026-10-02']);
    assert.equal(profile.daily.lastWinKey, '2026-10-02');
    assert.equal(profile.daily.streak, 2);
    assert.equal(profile.daily.best, 3);
  });

  it('takes the most recently changed name', () => {
    const merged = mergeSaves({ profile: { playerName: 'Old', playerNameAt: 10 } }, { profile: { playerName: 'Stale', playerNameAt: 5 } });
    assert.equal(merged.profile.playerName, 'Old');
  });

  it('lets the newest edit or deletion of content win', () => {
    const v1 = heroDef({ id: 'h-sync-1', name: 'Version One' });
    const v2 = heroDef({ id: 'h-sync-1', name: 'Version Two' });
    const gone = heroDef({ id: 'h-sync-2' });
    const merged = mergeSaves(
      { library: [entry(v1, 100), entry(gone, 100)] },
      { library: [entry(v2, 200)], deleted: { 'h-sync-2': 150 } },
    );
    assert.deepEqual(merged.library.map((item) => item.definition.name), ['Version Two']);
    assert.deepEqual(merged.deleted, { 'h-sync-2': 150 });

    const restored = mergeSaves(merged, { library: [entry(gone, 300)] });
    assert.ok(restored.library.some((item) => item.definition.id === 'h-sync-2'));
    assert.deepEqual(restored.deleted, {});
  });

  it('drops invalid content and unknown fields', () => {
    const save = sanitizeSave({
      profile: { renown: -5, installId: 'secret', stats: { runsWon: 'lots', created: 2 }, evil: true },
      library: [entry(heroDef({ id: 'h-bad', health: 0 }), 1), { definition: null }],
      deleted: { 'h-x': 'yesterday' },
    });
    assert.equal(save.profile.renown, 0);
    assert.equal(save.profile.installId, undefined);
    assert.equal(save.profile.evil, undefined);
    assert.deepEqual(save.profile.stats, { runsWon: 0, created: 2 });
    assert.deepEqual(save.library, []);
    assert.deepEqual(save.deleted, {});
  });

  it('is idempotent', () => {
    const save = { profile: { renown: 10, achievements: { a: 1 } }, library: [entry(heroDef({ id: 'h-idem' }), 5)] };
    const once = mergeSaves({}, save);
    assert.deepEqual(mergeSaves(once, save), once);
  });
});

describe('library deletions', () => {
  it('remembers removed content until it is saved again', () => {
    const { library } = makeLibrary();
    const hero = heroDef({ id: 'h-del-1' });
    library.save(hero);
    library.remove(hero.id);
    assert.ok(library.deletions()[hero.id] > 0);
    library.save(hero);
    assert.equal(library.deletions()[hero.id], undefined);
  });
});

/** An in-memory stand-in for the server's PUT /api/me/save. */
function fakeServer() {
  const server = { save: null, calls: 0, beforeAnswer: null };
  server.api = {
    available: true,
    token: null,
    login: async () => ({ token: 't'.repeat(30), user: { id: 'u1', username: 'Sam' } }),
    logout: async () => ({ ok: true }),
    syncSave: async (save) => {
      server.calls += 1;
      server.save = mergeSaves(server.save, structuredClone(save));
      const answer = structuredClone(server.save);
      await server.beforeAnswer?.();
      return { save: answer, updatedAt: new Date().toISOString() };
    },
  };
  return server;
}

function device(server) {
  const { adapter, library } = makeLibrary();
  const events = new EventBus();
  const profileStore = new JsonStore(adapter, 'profile', {});
  const profile = new Profile({ installId: 'install-local' });
  const account = new AccountService({
    api: server.api, store: new JsonStore(adapter, 'account', { token: null, user: null }), profile, profileStore, library, events, debounceMs: 1,
  });
  return { account, profile, library };
}

describe('AccountService', () => {
  it('carries progress and content from one device to another', async () => {
    const server = fakeServer();
    const first = device(server);
    first.profile.addRenown(400);
    first.library.save(heroDef({ id: 'h-travel', name: 'Traveller' }));
    await first.account.login('Sam', 'password1');

    const second = device(server);
    second.profile.addRenown(50);
    await second.account.login('Sam', 'password1');
    assert.equal(second.profile.renown, 400);
    assert.equal(second.library.get('h-travel').name, 'Traveller');
    assert.equal(second.profile.data.installId, 'install-local');
    assert.equal(second.profile.data.playerName, 'Sam');
  });

  it('keeps changes made while a sync is in flight', async () => {
    const server = fakeServer();
    const player = device(server);
    await player.account.login('Sam', 'password1');

    server.beforeAnswer = () => {
      server.beforeAnswer = null;
      player.profile.grantAchievement('mid-flight');
    };
    await player.account.sync();
    assert.ok(player.profile.hasAchievement('mid-flight'));
    assert.ok(server.save.profile.achievements['mid-flight'], 'the late change is sent in a follow-up sync');
  });

  it('signs out when the server rejects the session', async () => {
    const server = fakeServer();
    const player = device(server);
    await player.account.login('Sam', 'password1');
    server.api.syncSave = async () => { throw Object.assign(new Error('Please sign in again.'), { status: 401 }); };
    assert.equal(await player.account.sync(), false);
    assert.equal(player.account.user, null);
    assert.equal(server.api.token, null);
  });
});
