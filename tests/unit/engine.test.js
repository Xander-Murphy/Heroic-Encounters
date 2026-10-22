import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Combat } from '../../web/js/engine/Combat.js';
import { Random } from '../../web/js/engine/Random.js';
import { resolverFor } from '../../web/js/engine/targeting.js';
import { ResultKind } from '../../web/js/engine/types.js';
import { ability, factory, makeEnemy, makeHero } from '../helpers.js';

const status = (overrides) => ({ name: 'Effect', icon: '✨', type: 'buff', category: 'magical', magnitude: 5, duration: 2, schools: [], stat: 'attack', tickSchool: null, ...overrides });

describe('Character damage', () => {
  it('scales ability power by attack, then applies resistance and defense', () => {
    const hero = makeHero({ attack: 50, abilities: [ability({ power: 20, school: 'fire' })] });
    const enemy = makeEnemy({ defense: 3, resistances: { fire: 50 } });
    new Combat([hero], [enemy]).queueAction(hero, hero.abilities[0], [enemy]);
    const [result] = hero.abilities[0].apply(hero, [enemy]);
    // 20 * 1.5 = 30 → 50% resist = 15 → -3 defense = 12
    assert.equal(result.amount, 12);
    assert.equal(enemy.health, 88);
  });

  it('always deals at least 1 damage unless immune', () => {
    const enemy = makeEnemy({ defense: 20 });
    assert.equal(enemy.takeDamage(5, 'physical'), 1);
    enemy.addEffect(factory.createStatusEffect(status({ type: 'immunity', schools: ['physical'], stat: null })));
    assert.equal(enemy.takeDamage(50, 'physical'), 0);
  });

  it('caps healing at max health and cannot heal the dead', () => {
    const hero = makeHero({ health: 50 });
    hero.loseHealth(10);
    assert.equal(hero.heal(100), 10);
    hero.loseHealth(999);
    assert.equal(hero.heal(10), 0);
  });

  it('refreshes rather than stacks a re-applied effect', () => {
    const hero = makeHero();
    hero.addEffect(factory.createStatusEffect(status({ magnitude: 5 })));
    hero.addEffect(factory.createStatusEffect(status({ magnitude: 5 })));
    assert.equal(hero.activeEffects.length, 1);
    assert.equal(hero.getStat('attack'), 5);
  });

  it('ticks damage over time through resistances at round end', () => {
    const hero = makeHero({ resistances: { nature: 50 } });
    hero.addEffect(factory.createStatusEffect(status({ type: 'damage_over_time', magnitude: 10, duration: 1, tickSchool: 'nature', stat: null })));
    const [tick] = hero.endRound();
    assert.equal(tick.amount, 5);
    assert.equal(hero.activeEffects.length, 0, 'expired after its duration');
  });
});

describe('Abilities', () => {
  it('cooldown N means usable again after N skipped rounds', () => {
    const hit = factory.createAbility(ability({ cooldown: 1 }));
    hit.use();
    hit.reduceCooldown(); // end of the round it was used in
    assert.equal(hit.isReady(), false);
    hit.reduceCooldown();
    assert.equal(hit.isReady(), true);
  });

  it('lifesteal heals the user for a share of the damage', () => {
    const hero = makeHero({ abilities: [ability({ power: 40, effects: [{ type: 'lifesteal', percent: 50 }] })] });
    hero.loseHealth(50);
    const enemy = makeEnemy();
    const results = hero.abilities[0].apply(hero, [enemy]);
    assert.deepEqual(results.map((result) => result.kind), [ResultKind.DAMAGE, ResultKind.HEAL]);
    assert.equal(hero.health, 70);
  });

  it('dispel removes only matching harmful categories', () => {
    const cleanse = factory.createAbility(ability({ target: 'single_ally', effects: [{ type: 'dispel', categories: ['poison'], harmful: true }] }));
    const hero = makeHero();
    hero.addEffect(factory.createStatusEffect(status({ name: 'Poison', type: 'damage_over_time', category: 'poison', tickSchool: 'nature', stat: null })));
    hero.addEffect(factory.createStatusEffect(status({ name: 'Curse', type: 'debuff', category: 'curse' })));
    cleanse.apply(hero, [hero]);
    assert.deepEqual(hero.activeEffects.map((effect) => effect.name), ['Curse']);
  });
});

describe('Prototype cloning', () => {
  it('clones never share health, cooldowns or effects', () => {
    const original = makeEnemy({ abilities: [ability({ cooldown: 3 })] });
    const a = original.clone();
    const b = original.clone();
    a.loseHealth(30);
    a.abilities[0].use();
    a.addEffect(factory.createStatusEffect(status()));
    assert.equal(b.health, 100);
    assert.equal(b.abilities[0].isReady(), true);
    assert.equal(b.activeEffects.length, 0);
    assert.notEqual(a.uid, b.uid);
    assert.equal(a.behavior, b.behavior, 'stateless behavior is shared');
  });
});

describe('Targeting', () => {
  it('forces single-target attacks onto a taunting character', () => {
    const tank = makeHero({ name: 'Tank' });
    const other = makeHero({ name: 'Other' });
    const enemy = makeEnemy();
    const combat = new Combat([tank, other], [enemy]);
    tank.addEffect(factory.createStatusEffect(status({ type: 'taunt', stat: null })));
    assert.deepEqual(resolverFor('single_enemy').candidates(enemy, combat.battlefield), [tank]);
    assert.equal(resolverFor('all_enemies').candidates(enemy, combat.battlefield).length, 2);
  });
});

describe('Combat', () => {
  it('resolves fastest first, heroes winning ties', () => {
    const hero = makeHero({ speed: 5 });
    const enemy = makeEnemy({ speed: 5 });
    const combat = new Combat([hero], [enemy], { rng: new Random(1) });
    combat.planEnemyActions();
    combat.queueAction(hero, hero.basicAttack, [enemy]);
    combat.beginRound();
    assert.equal(combat.executeNextAction().action.actor, hero);
  });

  it('a stunned character loses its queued turn', () => {
    const stunAbility = ability({ priority: 10, effects: [{ type: 'damage' }, { type: 'status', status: status({ name: 'Stunned', type: 'stun', stat: null, duration: 1 }) }] });
    const hero = makeHero({ abilities: [stunAbility] });
    const enemy = makeEnemy({ speed: 9 });
    const combat = new Combat([hero], [enemy], { rng: new Random(1) });
    combat.planEnemyActions();
    combat.queueAction(hero, hero.abilities[0], [enemy]);
    const results = combat.resolveRound();
    assert.ok(results.some((result) => result.kind === ResultKind.SKIP));
    assert.equal(hero.health, 100);
  });

  it('retargets when the chosen target died earlier in the round', () => {
    const a = makeHero({ name: 'A', speed: 9, abilities: [ability({ power: 200 })] });
    const b = makeHero({ name: 'B', speed: 8 });
    const first = makeEnemy({ name: 'First', health: 10 });
    const second = makeEnemy({ name: 'Second' });
    const combat = new Combat([a, b], [first, second], { rng: new Random(3) });
    combat.queueAction(a, a.abilities[0], [first]);
    combat.queueAction(b, b.basicAttack, [first]);
    combat.resolveRound();
    assert.ok(second.health < 100);
  });

  it('bosses trigger phases once when crossing health thresholds', () => {
    const boss = factory.createEnemy({
      ...makeEnemyDefinition(), rank: 'boss',
      phases: [{ atHealthPercent: 50, message: 'Enrage!', status: status({ name: 'Enrage', magnitude: 10, duration: 99 }) }],
    });
    boss.loseHealth(60);
    assert.equal(boss.checkPhaseTransitions().length, 1);
    assert.equal(boss.checkPhaseTransitions().length, 0);
    assert.equal(boss.getStat('attack'), 10);
  });

  it('ends when one side has nobody left', () => {
    const hero = makeHero({ abilities: [ability({ power: 500 })] });
    const enemy = makeEnemy({ health: 10 });
    const combat = new Combat([hero], [enemy]);
    combat.queueAction(hero, hero.abilities[0], [enemy]);
    combat.resolveRound();
    assert.equal(combat.heroesWon(), true);
    assert.equal(combat.queueAction(hero, hero.basicAttack, [enemy]), null);
  });
});

function makeEnemyDefinition() {
  return {
    id: 'e-boss', kind: 'enemy', name: 'Boss', rank: 'minion', enemyType: 'physical', behavior: 'random', portrait: '💀',
    health: 100, attack: 0, defense: 0, speed: 1, resistances: {}, basicAttackSchool: 'physical', abilities: [ability()],
  };
}
