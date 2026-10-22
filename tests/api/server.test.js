import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { summarizeMetrics } from '../../server/api/MetricsController.js';
import { createApp } from '../../server/app.js';
import { RateLimiter } from '../../server/RateLimiter.js';
import { createStore } from '../../server/storage/createStore.js';
import { createBundle } from '../../web/js/sharing/bundle.js';
import { ShareCodec } from '../../web/js/sharing/ShareCodec.js';
import { heroDef } from '../helpers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const codec = new ShareCodec();

// MongoDB runs too when a test server is given, e.g. MONGODB_TEST_URI=mongodb://127.0.0.1:27017
const mongoUri = process.env.MONGODB_TEST_URI ?? '';

for (const kind of ['memory', 'sqlite', ...(mongoUri ? ['mongo'] : [])]) {
  describe(`community server (${kind} storage)`, () => {
    let server;
    let base;
    let store;
    let dataDir;

    before(async () => {
      dataDir = await mkdtemp(path.join(os.tmpdir(), 'he-test-'));
      ({ store } = await createStore({ kind, dataDir, mongoUri, mongoDbName: `he-test-${Date.now()}` }));
      const limiter = () => new RateLimiter({ capacity: 1000, perMinute: 1000 });
      server = http.createServer(createApp({ store, staticDir: path.join(root, 'web'), rateLimiter: limiter(), authRateLimiter: limiter() }));
      await new Promise((resolve) => { server.listen(0, resolve); });
      base = `http://localhost:${server.address().port}`;
    });

    after(async () => {
      server.close();
      if (kind === 'mongo') await store.db.dropDatabase();
      await store.close();
      await rm(dataDir, { recursive: true, force: true });
    });

    const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const shareOf = (items) => codec.encode(createBundle({ items, author: 'Tester' }));

    it('serves the game and blocks path traversal', async () => {
      const page = await fetch(`${base}/`);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /Heroic Encounters/);
      assert.ok(page.headers.get('content-security-policy'));
      const escape = await fetch(`${base}/%2e%2e/package.json`);
      assert.notEqual(escape.status, 200);
    });

    it('publishes, fetches by code, lists and is idempotent', async () => {
      const shareString = await shareOf([heroDef({ id: 'h-api-1', name: 'Api Hero' })]);
      const first = await (await post('/api/content', { shareString, kind: 'hero', title: 'Api Hero' })).json();
      assert.match(first.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      const again = await (await post('/api/content', { shareString: await shareOf([heroDef({ id: 'h-api-1', name: 'Api Hero' })]) })).json();
      assert.equal(again.code, first.code);

      const entry = await (await fetch(`${base}/api/content/${first.code.toLowerCase().replace('-', '')}`)).json();
      assert.equal(entry.shareString, shareString);
      const list = await (await fetch(`${base}/api/content?kind=hero`)).json();
      assert.equal(list.items.length, 1);
      assert.deepEqual(list.items[0].itemIds, ['h-api-1']);
      assert.equal(list.items[0].shareString, undefined);
    });

    it('rejects invalid content and garbage', async () => {
      const bad = await post('/api/content', { shareString: await shareOf([heroDef({ id: 'h-api-bad', health: 0 })]) });
      assert.equal(bad.status, 422);
      assert.equal((await post('/api/content', { shareString: 'HE1.nope' })).status, 400);
      assert.equal((await fetch(`${base}/api/content/not-a-code`)).status, 400);
    });

    it('counts one like per install', async () => {
      const { code } = await (await post('/api/content', { shareString: await shareOf([heroDef({ id: 'h-api-like' })]) })).json();
      const first = await (await post(`/api/content/${code}/like`, { installId: 'i-abcdef123' })).json();
      const second = await (await post(`/api/content/${code}/like`, { installId: 'i-abcdef123' })).json();
      assert.equal(first.likes, 1);
      assert.equal(second.alreadyLiked, true);
    });

    const authed = (token) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

    it('registers, signs in and out', async () => {
      const created = await post('/api/auth/register', { username: 'Ana_1', password: 'correct horse' });
      assert.equal(created.status, 201);
      const { token, user } = await created.json();
      assert.equal(user.username, 'Ana_1');
      assert.equal((await post('/api/auth/register', { username: 'ana_1', password: 'another one' })).status, 409);
      assert.equal((await post('/api/auth/register', { username: 'x', password: 'correct horse' })).status, 400);
      assert.equal((await post('/api/auth/login', { username: 'ANA_1', password: 'wrong password' })).status, 401);
      assert.equal((await post('/api/auth/login', { username: 'nobody', password: 'wrong password' })).status, 401);

      const login = await (await post('/api/auth/login', { username: 'ANA_1', password: 'correct horse' })).json();
      assert.notEqual(login.token, token);
      const me = await (await fetch(`${base}/api/auth/me`, { headers: authed(login.token) })).json();
      assert.equal(me.user.id, user.id);

      await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: authed(login.token), body: '{}' });
      assert.equal((await fetch(`${base}/api/auth/me`, { headers: authed(login.token) })).status, 401);
      assert.equal((await fetch(`${base}/api/auth/me`, { headers: authed(token) })).status, 200, 'other sessions stay signed in');
    });

    it('merges saves from two devices', async () => {
      const { token } = await (await post('/api/auth/register', { username: 'Syncer', password: 'password123' })).json();
      const put = (save) => fetch(`${base}/api/me/save`, { method: 'PUT', headers: authed(token), body: JSON.stringify({ save }) }).then((response) => response.json());
      assert.equal((await fetch(`${base}/api/me/save`)).status, 401);

      await put({ profile: { renown: 200, achievements: { a: 1 } }, library: [{ definition: heroDef({ id: 'h-cloud-1' }), meta: { updatedAt: 5 } }] });
      const merged = await put({ profile: { renown: 50, achievements: { b: 2 } } });
      assert.equal(merged.save.profile.renown, 200);
      assert.deepEqual(Object.keys(merged.save.profile.achievements).sort(), ['a', 'b']);
      assert.deepEqual(merged.save.library.map((item) => item.definition.id), ['h-cloud-1']);

      const stored = await (await fetch(`${base}/api/me/save`, { headers: authed(token) })).json();
      assert.deepEqual(stored.save, merged.save);
    });

    it('credits signed-in uploads to the account and counts one like per account', async () => {
      const { token } = await (await post('/api/auth/register', { username: 'Maker', password: 'password123' })).json();
      const shareString = await shareOf([heroDef({ id: 'h-api-owned' })]);
      const publish = await fetch(`${base}/api/content`, { method: 'POST', headers: authed(token), body: JSON.stringify({ shareString, author: 'Someone Else' }) });
      const { code } = await publish.json();
      const entry = await (await fetch(`${base}/api/content/${code}`)).json();
      assert.equal(entry.author, 'Maker');

      const like = (installId) => fetch(`${base}/api/content/${code}/like`, { method: 'POST', headers: authed(token), body: JSON.stringify({ installId }) }).then((response) => response.json());
      assert.equal((await like('i-device-one')).likes, 1);
      assert.equal((await like('i-device-two')).alreadyLiked, true);
    });

    it('ingests anonymous metrics and summarizes them', async () => {
      await post('/api/metrics', { installId: 'i-metrics-1', events: [{ name: 'run.started' }, { name: 'run.finished', props: { reachedBoss: true } }, { name: 'not.allowed' }] });
      const summary = await (await fetch(`${base}/api/metrics/summary`)).json();
      assert.equal(summary.dailyActive, 1);
      assert.equal(summary.runCompletion, 1);
    });
  });
}

describe('summarizeMetrics', () => {
  it('computes return rates from install activity', () => {
    const summary = summarizeMetrics({
      installDays: new Map([
        ['a', ['2026-10-01', '2026-10-02', '2026-10-09']],
        ['b', ['2026-10-01']],
        ['c', ['2026-10-20']],
      ]),
      eventCounts: { 'run.started': 4 },
      reachedBoss: 2,
      heroUnlocks: new Map([['a', 2]]),
    }, '2026-10-21');
    assert.equal(summary.returnRate1Day, 1 / 3);
    assert.equal(summary.returnRate7Day, 1 / 2);
    assert.equal(summary.runCompletion, 0.5);
    assert.equal(summary.heroesUnlockedPerPlayer, 4 + 2 / 3);
  });
});
