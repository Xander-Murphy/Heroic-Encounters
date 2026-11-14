import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isLocalDevServer } from '../../web/js/config.js';

const page = (href) => new URL(href);
const answering = (body, ok = true) => async () => ({ ok, json: async () => body });

describe('isLocalDevServer', () => {
  it('is true for a local `npm run dev` server', async () => {
    let asked;
    const fetchImpl = async (url) => { asked = url; return { ok: true, json: async () => ({ ok: true, dev: true }) }; };
    assert.equal(await isLocalDevServer({ location: page('http://localhost:8080/'), fetchImpl }), true);
    assert.equal(asked, 'http://localhost:8080/api/health');
  });

  it('is false for a plain `npm start`, a static server or a broken answer', async () => {
    const local = page('http://127.0.0.1:8080/');
    assert.equal(await isLocalDevServer({ location: local, fetchImpl: answering({ ok: true, dev: false }) }), false);
    assert.equal(await isLocalDevServer({ location: local, fetchImpl: answering({}, false) }), false);
    assert.equal(await isLocalDevServer({ location: local, fetchImpl: async () => { throw new Error('refused'); } }), false);
  });

  it('never asks when the game is hosted somewhere else', async () => {
    let asked = false;
    const fetchImpl = async () => { asked = true; return { ok: true, json: async () => ({ dev: true }) }; };
    assert.equal(await isLocalDevServer({ location: page('https://xander-murphy.github.io/Heroic-Encounters/'), fetchImpl }), false);
    assert.equal(asked, false);
  });
});
