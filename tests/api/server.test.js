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

for (const kind of ['memory', 'sqlite']) {
  describe(`community server (${kind} storage)`, () => {
    let server;
    let base;
    let store;
    let dataDir;

    before(async () => {
      dataDir = await mkdtemp(path.join(os.tmpdir(), 'he-test-'));
      ({ store } = await createStore({ kind, dataDir }));
      server = http.createServer(createApp({ store, staticDir: path.join(root, 'web'), rateLimiter: new RateLimiter({ capacity: 1000, perMinute: 1000 }) }));
      await new Promise((resolve) => { server.listen(0, resolve); });
      base = `http://localhost:${server.address().port}`;
    });

    after(async () => {
      server.close();
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
