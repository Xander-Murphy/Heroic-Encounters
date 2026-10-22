import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EventBus } from '../../web/js/EventBus.js';
import { DungeonRun, RunState } from '../../web/js/engine/DungeonRun.js';
import { Random } from '../../web/js/engine/Random.js';
import { DailyChallenge } from '../../web/js/progression/DailyChallenge.js';
import { Profile, renownForNextLevel } from '../../web/js/progression/Profile.js';
import { ProgressionService } from '../../web/js/progression/ProgressionService.js';
import { makeLibrary } from '../helpers.js';

describe('Profile', () => {
  it('derives level from total renown', () => {
    const profile = new Profile();
    assert.equal(profile.level, 1);
    assert.equal(profile.addRenown(renownForNextLevel(1) + renownForNextLevel(2)), 2);
    assert.equal(profile.level, 3);
    assert.equal(profile.levelInfo.intoLevel, 0);
  });

  it('counts consecutive daily wins as a streak and resets after a gap', () => {
    const profile = new Profile();
    profile.recordDailyWin('2026-10-01');
    profile.recordDailyWin('2026-10-02');
    assert.equal(profile.recordDailyWin('2026-10-02'), false, 'only once per day');
    assert.equal(profile.data.daily.streak, 2);
    assert.equal(profile.currentStreak('2026-10-03'), 2);
    assert.equal(profile.currentStreak('2026-10-05'), 0);
    profile.recordDailyWin('2026-10-05');
    assert.equal(profile.data.daily.streak, 1);
    assert.equal(profile.data.daily.best, 2);
  });
});

describe('DailyChallenge', () => {
  it('is the same for everyone on a given day and changes between days', () => {
    const { library } = makeLibrary();
    const a = DailyChallenge.forDate(library, new Date(2026, 9, 21));
    const b = DailyChallenge.forDate(library, new Date(2026, 9, 21, 23, 0));
    const c = DailyChallenge.forDate(library, new Date(2026, 9, 22));
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
    assert.equal(a.heroIds.length, 3);
  });
});

describe('ProgressionService', () => {
  const setup = () => {
    const { library } = makeLibrary();
    const events = new EventBus();
    const seen = [];
    events.on('*', (_payload, name) => seen.push(name));
    const profile = new Profile();
    return { library, profile, seen, progression: new ProgressionService({ profile, library, events, store: null }) };
  };

  const wonRun = (library, extra = {}) => {
    const run = new DungeonRun({
      dungeon: library.get('core:emberdeep'), party: ['core:koryne', 'core:genjo', 'core:braeks'].map((id) => library.instantiate(id)),
      enemyFactory: library.enemyFactory, rng: new Random(1), ...extra,
    });
    run.state = RunState.WON;
    run.waveIndex = run.dungeon.waves.length;
    Object.assign(run.stats, { enemiesDefeated: 10, encountersWon: 4, rounds: 20, bossDefeated: true });
    return run;
  };

  it('starts with four heroes and unlocks more through levels and achievements', () => {
    const { library, progression, profile } = setup();
    assert.equal(progression.availableHeroes().length, 4);
    const report = progression.completeRun(wonRun(library));
    assert.ok(report.renown > 0);
    assert.ok(profile.hasAchievement('first_clear'));
    const unlocked = report.heroesUnlocked.map((hero) => hero.name);
    assert.ok(unlocked.includes('Ysolde'), 'achievement unlock');
    assert.ok(unlocked.includes('Elara'), 'level unlock');
  });

  it('awards the daily bonus once and emits analytics events', () => {
    const { library, progression, seen } = setup();
    const first = progression.completeRun(wonRun(library, { tags: { daily: '2026-10-21' } }));
    const second = progression.completeRun(wonRun(library, { tags: { daily: '2026-10-21' } }));
    assert.equal(first.dailyWon, true);
    assert.ok(!second.dailyWon);
    assert.ok(seen.includes('run.finished'));
    assert.ok(seen.includes('achievement.unlocked'));
  });

  it('records creating, sharing and importing for community achievements', () => {
    const { progression, profile } = setup();
    progression.recordCreation({ kind: 'dungeon' }, { isNew: true });
    progression.recordShare();
    progression.recordImport(1);
    for (const id of ['creator', 'architect', 'generous', 'guest']) assert.ok(profile.hasAchievement(id), id);
  });
});
