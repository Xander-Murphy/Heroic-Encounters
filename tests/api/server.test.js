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
    let publisher;

    before(async () => {
      dataDir = await mkdtemp(path.join(os.tmpdir(), 'he-test-'));
      ({ store } = await createStore({ kind, dataDir, mongoUri, mongoDbName: `he-test-${Date.now()}` }));
      const limiter = () => new RateLimiter({ capacity: 1000, perMinute: 1000 });
      server = http.createServer(createApp({ store, staticDir: path.join(root, 'web'), rateLimiter: limiter(), authRateLimiter: limiter() }));
      await new Promise((resolve) => { server.listen(0, resolve); });
      base = `http://localhost:${server.address().port}`;
      ({ token: publisher } = await (await post('/api/auth/register', { username: 'Publisher', password: 'password123' })).json());
    });

    after(async () => {
      server.close();
      if (kind === 'mongo') await store.db.dropDatabase();
      await store.close();
      await rm(dataDir, { recursive: true, force: true });
    });

    const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const publish = (body) => fetch(`${base}/api/content`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publisher}` }, body: JSON.stringify(body) });
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
      const first = await (await publish({ shareString, kind: 'hero', title: 'Api Hero' })).json();
      assert.match(first.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      const again = await (await publish({ shareString: await shareOf([heroDef({ id: 'h-api-1', name: 'Api Hero' })]) })).json();
      assert.equal(again.code, first.code);

      const entry = await (await fetch(`${base}/api/content/${first.code.toLowerCase().replace('-', '')}`)).json();
      assert.equal(entry.shareString, shareString);
      const list = await (await fetch(`${base}/api/content?kind=hero`)).json();
      assert.equal(list.items.length, 1);
      assert.deepEqual(list.items[0].itemIds, ['h-api-1']);
      assert.equal(list.items[0].shareString, undefined);
    });

    it('needs an account to publish, but not to browse or fetch', async () => {
      const shareString = await shareOf([heroDef({ id: 'h-api-guest', name: 'Guest Attempt' })]);
      const refused = await post('/api/content', { shareString, kind: 'hero' });
      assert.equal(refused.status, 401);
      assert.match((await refused.json()).error, /Sign in/);
      assert.equal((await post('/api/content', { shareString: 'not even a share string' })).status, 401, 'checked before anything is decoded');

      const { code } = await (await publish({ shareString, kind: 'hero' })).json();
      assert.equal((await fetch(`${base}/api/content/${code}`)).status, 200);
      assert.equal((await fetch(`${base}/api/content`)).status, 200);
    });

    it('rejects invalid content and garbage', async () => {
      const bad = await publish({ shareString: await shareOf([heroDef({ id: 'h-api-bad', health: 0 })]) });
      assert.equal(bad.status, 422);
      assert.equal((await publish({ shareString: 'HE1.nope' })).status, 400);
      assert.equal((await fetch(`${base}/api/content/not-a-code`)).status, 400);
    });

    it('counts one like per install', async () => {
      const { code } = await (await publish({ shareString: await shareOf([heroDef({ id: 'h-api-like' })]) })).json();
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

    describe('managing an upload', () => {
      const signUp = async (username) => (await (await post('/api/auth/register', { username, password: 'password123' })).json()).token;
      const send = (method, url, token, body) => fetch(base + url, {
        method,
        headers: token ? authed(token) : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const publishAs = async (token, hero) => (await (await send('POST', '/api/content', token, { shareString: await shareOf([hero]), kind: 'hero' })).json()).code;

      it('lets the owner update it, keeping the code, likes and downloads', async () => {
        const token = await signUp('Updater');
        const code = await publishAs(token, heroDef({ id: 'h-upd-1', name: 'First Draft' }));
        await post(`/api/content/${code}/like`, { installId: 'i-liker-12345' });
        await post(`/api/content/${code}/download`, {});

        const shareString = await shareOf([heroDef({ id: 'h-upd-1', name: 'Final Draft' })]);
        const update = await send('PUT', `/api/content/${code}`, token, { shareString, title: 'Final Draft', author: 'Someone Else' });
        assert.equal(update.status, 200);
        assert.deepEqual(await update.json(), { code, updated: true });

        const entry = await (await fetch(`${base}/api/content/${code}`)).json();
        assert.equal(entry.title, 'Final Draft');
        assert.equal(entry.author, 'Updater');
        assert.equal(entry.shareString, shareString);
        assert.equal(entry.likes, 1);
        assert.equal(entry.downloads, 1);
        assert.ok(entry.updatedAt);

        const unchanged = await send('PUT', `/api/content/${code}`, token, { shareString: await shareOf([heroDef({ id: 'h-upd-1', name: 'Final Draft' })]) });
        assert.equal((await unchanged.json()).updated, false);
      });

      it('updates instead of duplicating when an account republishes its own hero', async () => {
        const token = await signUp('Forgetful');
        const code = await publishAs(token, heroDef({ id: 'h-lost-1', name: 'Original' }));
        const stranger = await signUp('SameIdPlayer');

        const again = await send('POST', '/api/content', token, { shareString: await shareOf([heroDef({ id: 'h-lost-1', name: 'Edited' })]), kind: 'hero', title: 'Edited' });
        assert.deepEqual(await again.json(), { code, updated: true });
        assert.equal((await (await fetch(`${base}/api/content/${code}`)).json()).title, 'Edited');

        const other = await publishAs(stranger, heroDef({ id: 'h-lost-1', name: 'Their Own Version' }));
        assert.notEqual(other, code, 'another account gets its own entry');
      });

      it('lists only the account\'s own uploads, newest first', async () => {
        assert.equal((await send('GET', '/api/me/content', null)).status, 401);
        const token = await signUp('Collector');
        const stranger = await signUp('NotCollector');
        const first = await publishAs(token, heroDef({ id: 'h-col-1', name: 'First' }));
        await new Promise((resolve) => { setTimeout(resolve, 5); });
        const second = await publishAs(token, heroDef({ id: 'h-col-2', name: 'Second' }));
        await publishAs(stranger, heroDef({ id: 'h-col-3', name: 'Theirs' }));

        const { items } = await (await send('GET', '/api/me/content', token)).json();
        assert.deepEqual(items.map((item) => item.code), [second, first]);
        assert.ok(items[0].shareString);
        assert.equal(items[0].ownerId, undefined);
      });

      it('refuses invalid updates and content published elsewhere', async () => {
        const token = await signUp('Careful');
        const code = await publishAs(token, heroDef({ id: 'h-upd-2', name: 'Valid' }));
        const other = await publishAs(token, heroDef({ id: 'h-upd-3', name: 'Other' }));
        const invalid = await send('PUT', `/api/content/${code}`, token, { shareString: await shareOf([heroDef({ id: 'h-upd-2', health: 0 })]) });
        assert.equal(invalid.status, 422);
        const duplicate = await send('PUT', `/api/content/${code}`, token, { shareString: await shareOf([heroDef({ id: 'h-upd-3', name: 'Other' })]) });
        assert.equal(duplicate.status, 409);
        assert.match((await duplicate.json()).error, new RegExp(other));
        assert.equal((await (await fetch(`${base}/api/content/${code}`)).json()).title, 'Valid');
      });

      it('only lets the owning account change or remove it', async () => {
        const owner = await signUp('OwnerOne');
        const stranger = await signUp('Stranger');
        const code = await publishAs(owner, heroDef({ id: 'h-own-1', name: 'Protected' }));
        // An upload from before publishing needed an account.
        const { code: guestCode } = await store.insertContent({
          code: 'GUES-TTTT', hash: 'old-guest-upload', kind: 'hero', title: 'Guest Upload', author: '', description: '',
          shareString: await shareOf([heroDef({ id: 'h-own-2' })]), itemCount: 1, itemIds: ['h-own-2'], createdAt: new Date().toISOString(),
        });
        const change = { shareString: await shareOf([heroDef({ id: 'h-own-1', name: 'Hijacked' })]) };

        assert.equal((await send('PUT', `/api/content/${code}`, null, change)).status, 401);
        assert.equal((await send('PUT', `/api/content/${code}`, stranger, change)).status, 403);
        assert.equal((await send('DELETE', `/api/content/${code}`, null)).status, 401);
        assert.equal((await send('DELETE', `/api/content/${code}`, stranger)).status, 403);
        assert.equal((await send('DELETE', `/api/content/${guestCode}`, owner)).status, 403, 'guest uploads have no owner');
        assert.equal((await (await fetch(`${base}/api/content/${code}`)).json()).title, 'Protected');
      });

      it('tells a player which listings are theirs without exposing owner ids', async () => {
        const token = await signUp('Lister');
        const code = await publishAs(token, heroDef({ id: 'h-mine-1', name: 'Listed Hero' }));
        const find = async (requester) => (await (await send('GET', '/api/content?sort=recent&limit=50', requester)).json()).items.find((item) => item.code === code);
        const mine = await find(token);
        assert.equal(mine.mine, true);
        assert.equal(mine.ownerId, undefined);
        assert.equal((await find(null)).mine, false);
      });

      it('removes it and frees its content to be published again', async () => {
        const token = await signUp('Remover');
        const hero = heroDef({ id: 'h-del-api', name: 'Short Lived' });
        const code = await publishAs(token, hero);
        await post(`/api/content/${code}/like`, { installId: 'i-liker-67890' });

        assert.equal((await send('DELETE', `/api/content/${code}`, token)).status, 200);
        assert.equal((await fetch(`${base}/api/content/${code}`)).status, 404);
        assert.equal((await send('DELETE', `/api/content/${code}`, token)).status, 404);

        const again = await publishAs(token, hero);
        assert.notEqual(again, code);
        assert.equal((await (await fetch(`${base}/api/content/${again}`)).json()).likes, 0);
      });
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
