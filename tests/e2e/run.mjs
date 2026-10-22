/**
 * End-to-end browser test: two players on one server.
 *
 *   Player A plays a dungeon, creates a hero in the Workshop, copies a share
 *   string and publishes it to the community database.
 *   Player B (a separate browser profile) imports the share string, then
 *   imports via the community code, and plays with the imported hero.
 *
 * Needs Playwright:  npm i -D playwright && npx playwright install chromium
 * Run:               npm run test:e2e
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../../server/app.js';
import { MemoryCommunityStore } from '../../server/storage/MemoryCommunityStore.js';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('Playwright is not installed — skipping e2e tests. (npm i -D playwright && npx playwright install chromium)');
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const store = await MemoryCommunityStore.open({});
const server = http.createServer(createApp({ store, staticDir: path.join(root, 'web'), storageKind: 'memory' }));
await new Promise((resolve) => { server.listen(0, resolve); });
const base = `http://localhost:${server.address().port}/`;

const fastSettings = "localStorage.setItem('heroic-encounters:v1:settings', JSON.stringify({ motion: 'reduced', animationSpeed: 2.5, shareAnalytics: true, serverUrl: '' }))";
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const errors = [];

async function newPlayer(name) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, bypassCSP: true, permissions: ['clipboard-read', 'clipboard-write'] });
  await context.addInitScript(fastSettings);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`${name}: ${message.text()}`); });
  await page.goto(base);
  await page.waitForSelector('.hero-banner');
  return page;
}

async function step(label, fn) {
  process.stdout.write(`• ${label} … `);
  await fn();
  console.log('ok');
}

/** Give every hero an order (first ready ability, first valid target) and execute rounds until the run ends. */
async function playRun(page) {
  for (let guard = 0; guard < 150; guard++) {
    if (await page.locator('.result-banner').count()) return page.locator('.result-banner h1').innerText();
    if (await page.locator('.interlude button').count()) {
      await page.click('.interlude button');
      continue;
    }
    for (let i = 0; i < 4 && await page.locator('.tcg-card.selected').count(); i++) {
      await page.locator('.ability-btn:not([disabled])').first().click();
      const target = page.locator('.tcg-card.targetable, .tcg-card.ally-target');
      if (await target.count()) await target.first().click();
    }
    const execute = page.locator('button.execute');
    if (await execute.isEnabled()) {
      await execute.click();
      await page.waitForFunction(() => !document.querySelector('.combat-layout.animating'), null, { timeout: 30_000 });
    }
  }
  throw new Error('Run did not finish');
}

try {
  const alice = await newPlayer('Alice');

  await step('Alice sets her creator name', async () => {
    await alice.fill('.name-prompt input', 'Alice');
    await alice.click('.name-prompt button');
    await alice.waitForSelector('.level-bar b:text("Alice")');
  });

  await step('Alice plays a full dungeon run', async () => {
    await alice.click('.nav-btn:has-text("Play")');
    const cards = alice.locator('.roster-cell .tcg-card.clickable');
    for (const index of [0, 1, 3]) await cards.nth(index).click();
    await alice.click('.dungeon-card:has-text("Emberdeep")');
    await alice.click('.sticky-start button');
    const result = await playRun(alice);
    assert.match(result, /Victory|Defeat/);
    assert.ok(await alice.locator('.reward-lines li.total').count(), 'rewards shown');
  });

  await step('Alice creates a hero in the Workshop', async () => {
    await alice.click('.nav-btn:has-text("Workshop")');
    await alice.click('.header-actions button:has-text("New hero")');
    await alice.fill('.editor-form .field:has(label:text-is("Name")) input >> nth=0', 'Pip the Bard');
    await alice.fill('.editor-form .field:has(label:text-is("Class")) input', 'Bard');
    await alice.locator('.preset-grid button:has-text("Heal every ally")').click();
    await alice.waitForSelector('.preview-card .tcg-ribbon:text("Pip the Bard")');
    await alice.click('.editor-actions button:has-text("Save")');
    await alice.waitForSelector('.workshop-item h3:text("Pip the Bard")');
  });

  let shareString;
  await step('Alice copies a share string', async () => {
    await alice.click('.workshop-item button:has-text("Share")');
    shareString = await alice.locator('textarea.share-string').inputValue();
    assert.match(shareString, /^HE1\./);
  });

  let code;
  await step('Alice publishes it to the community database', async () => {
    await alice.click('dialog button:has-text("Publish to community")');
    code = (await alice.locator('.big-code').innerText()).trim();
    assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    await alice.click('dialog button:has-text("Done")');
  });

  const bob = await newPlayer('Bob');

  await step('Bob imports the share string', async () => {
    await bob.click('.nav-btn:has-text("Community")');
    await bob.fill('.import-panel textarea', shareString);
    await bob.click('.import-panel button[type=submit]');
    await bob.waitForSelector('dialog .import-item:has-text("Pip the Bard")');
    await bob.click('dialog button:has-text("Import 1 item")');
    await bob.click('.nav-btn:has-text("Workshop")');
    await bob.waitForSelector('.workshop-item:has-text("Pip the Bard") .pill:has-text("Imported from Alice")');
  });

  await step('Bob finds it in the community list and sees it is already his', async () => {
    await bob.click('.nav-btn:has-text("Community")');
    await bob.waitForSelector(`.community-entry:has-text("${code}") .pill:has-text("In your collection")`);
  });

  await step('Carol imports by community code and plays with the hero', async () => {
    const carol = await newPlayer('Carol');
    await carol.click('.nav-btn:has-text("Community")');
    await carol.fill('.import-panel textarea', code.toLowerCase());
    await carol.click('.import-panel button[type=submit]');
    await carol.click('dialog button:has-text("Import 1 item")');
    await carol.click('.nav-btn:has-text("Play")');
    await carol.click('.tabs button:has-text("Imported")');
    await carol.locator('.roster-cell .tcg-card.clickable:has-text("Pip the Bard")').click();
    await carol.click('.tabs button:has-text("Built-in")');
    const cards = carol.locator('.roster-cell .tcg-card.clickable');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await carol.click('.dungeon-card:has-text("Emberdeep")');
    await carol.click('.sticky-start button');
    await carol.waitForSelector('.team-row .tcg-card:has-text("Pip the Bard")');
  });

  await step('Share links open the import dialog', async () => {
    const dave = await newPlayer('Dave');
    await dave.goto(`${base}#import=${shareString}`);
    await dave.waitForSelector('dialog .import-item:has-text("Pip the Bard")');
  });

  await step('Profile shows achievements', async () => {
    await alice.click('.nav-btn:has-text("Profile")');
    await alice.waitForSelector('.achievement.earned:has-text("Creator")');
    await alice.waitForSelector('.achievement.earned:has-text("Generous")');
  });

  assert.deepEqual(errors, [], `Browser errors:\n${errors.join('\n')}`);
  console.log('\nAll e2e checks passed.');
} finally {
  await browser.close();
  server.close();
}
