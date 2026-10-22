import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DungeonRun, RunState } from '../../web/js/engine/DungeonRun.js';
import { Random } from '../../web/js/engine/Random.js';
import { createModifier } from '../../web/js/engine/RunModifier.js';
import { resolverFor } from '../../web/js/engine/targeting.js';
import { makeLibrary } from '../helpers.js';

/** Plays a whole run: each hero uses its first ready ability on the first valid target. */
function autoplay(run) {
  const spawned = [];
  while (!run.isOver) {
    const combat = run.startEncounter();
    spawned.push(combat.enemies.map((enemy) => enemy.contentId));
    for (let guard = 0; !combat.isOver(); guard++) {
      assert.ok(guard < 100, 'combat should end');
      combat.planEnemyActions();
      for (const hero of combat.heroesAwaitingOrders()) {
        const ability = hero.usableAbilities()[0];
        combat.queueAction(hero, ability, resolverFor(ability.target).resolve(hero, combat.battlefield, 0));
      }
      run.record(combat.resolveRound());
    }
    run.finishEncounter();
  }
  return spawned;
}

describe('DungeonRun', () => {
  const start = (seed, extra = {}) => {
    const { library } = makeLibrary();
    return new DungeonRun({
      dungeon: library.get('core:emberdeep'),
      party: ['core:koryne', 'core:braeks', 'core:scatter'].map((id) => library.instantiate(id)),
      enemyFactory: library.enemyFactory,
      rng: new Random(seed),
      ...extra,
    });
  };

  it('plays from the first wave to a win or a loss', () => {
    const run = start(7);
    autoplay(run);
    assert.ok([RunState.WON, RunState.LOST].includes(run.state));
    assert.ok(run.stats.rounds > 0);
    assert.ok(run.log.length > 0);
  });

  it('spawns the same waves for the same seed (daily challenge fairness)', () => {
    const a = start(42);
    const b = start(42);
    assert.deepEqual(a.startEncounter().enemies.map((enemy) => enemy.contentId), b.startEncounter().enemies.map((enemy) => enemy.contentId));
  });

  it('does not share state between runs using the same prototypes', () => {
    const first = start(1);
    first.party[0].loseHealth(30);
    assert.equal(start(1).party[0].health, start(1).party[0].maxHealth);
  });

  it('applies run modifiers', () => {
    const run = start(3, { modifiers: [createModifier({ id: 'wounded', params: { percent: 50 } })] });
    assert.equal(run.party[0].health, Math.round(run.party[0].maxHealth / 2));
  });

  it('abandoning ends the run as a loss', () => {
    const run = start(5);
    run.startEncounter();
    run.abandon();
    assert.equal(run.state, RunState.LOST);
  });
});
