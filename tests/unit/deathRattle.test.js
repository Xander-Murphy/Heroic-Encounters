import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ratePower } from '../../web/js/content/powerBudget.js';
import { validateDefinition } from '../../web/js/content/schema.js';
import { Combat } from '../../web/js/engine/Combat.js';
import { ResultKind } from '../../web/js/engine/types.js';
import {
  ability, enemyDef, factory, heroDef, makeEnemy, makeHero,
} from '../helpers.js';

/** A death rattle definition (cooldown/priority are ignored for death rattles). */
const rattle = (overrides) => ability({ name: 'Rattle', power: 10, target: 'all_enemies', ...overrides });
const killer = () => makeHero({ abilities: [ability({ name: 'Smite', power: 999 })] });
const rattleResults = (results) => results.filter((result) => result.kind === ResultKind.DEATH_RATTLE);

describe('Death rattles in combat', () => {
  it('fire when the character dies and hit their group target', () => {
    const hero = killer();
    const doomed = makeEnemy({ deathRattle: rattle() });
    const bystander = makeEnemy();
    const combat = new Combat([hero], [doomed, bystander]);
    combat.queueAction(hero, hero.abilities[0], [doomed]);

    const results = combat.resolveRound();
    assert.equal(rattleResults(results).length, 1);
    assert.equal(hero.health, 90, 'the dying enemy hit every hero for 10');
    assert.equal(bystander.health, 100, "it didn't hit its own side");
  });

  it('fire only once', () => {
    const hero = killer();
    const doomed = makeEnemy({ deathRattle: rattle() });
    const combat = new Combat([hero], [doomed, makeEnemy({ health: 500 })]);
    combat.queueAction(hero, hero.abilities[0], [doomed]);
    combat.resolveRound();
    combat.queueAction(hero, hero.basicAttack, [combat.enemies[1]]);
    assert.equal(rattleResults(combat.resolveRound()).length, 0);
    assert.equal(hero.health, 90);
  });

  it("don't fire when that death ends the fight", () => {
    const hero = killer();
    const lastEnemy = makeEnemy({ deathRattle: rattle({ power: 999 }) });
    const combat = new Combat([hero], [lastEnemy]);
    combat.queueAction(hero, hero.abilities[0], [lastEnemy]);

    assert.equal(rattleResults(combat.resolveRound()).length, 0);
    assert.ok(combat.heroesWon(), 'killing the last enemy always wins');
    assert.equal(hero.health, 100);
  });

  it('can target everyone, but never the dead caster', () => {
    const hero = killer();
    const doomed = makeEnemy({ deathRattle: rattle({ target: 'everyone' }) });
    const bystander = makeEnemy();
    const combat = new Combat([hero], [doomed, bystander]);
    combat.queueAction(hero, hero.abilities[0], [doomed]);

    const hits = combat.resolveRound().filter((result) => result.source === doomed && result.kind === ResultKind.DAMAGE);
    assert.deepEqual(hits.map((hit) => hit.target).sort((a, b) => a.uid - b.uid), [hero, bystander].sort((a, b) => a.uid - b.uid));
    assert.equal(hero.health, 90);
    assert.equal(bystander.health, 90);
  });

  it('can buff allies (a positive death rattle)', () => {
    const hero = killer();
    const buff = { type: 'status', status: { name: 'Avenge', icon: '🚩', type: 'buff', category: 'physical', magnitude: 6, duration: 2, schools: [], stat: 'attack' } };
    const doomed = makeEnemy({ deathRattle: rattle({ power: 0, target: 'all_allies', effects: [buff] }) });
    const ally = makeEnemy({ attack: 10 });
    const combat = new Combat([hero], [doomed, ally]);
    combat.queueAction(hero, hero.abilities[0], [doomed]);
    combat.resolveRound();
    assert.equal(ally.getStat('attack'), 16);
  });

  it('chain: a death rattle that kills another character fires that one too', () => {
    const hero = killer();
    const first = makeEnemy({ deathRattle: rattle({ target: 'all_allies' }) }); // hurts its own side
    const second = makeEnemy({ health: 5, deathRattle: rattle({ power: 25 }) });
    const tank = makeEnemy({ health: 500 });
    const combat = new Combat([hero], [first, second, tank]);
    combat.queueAction(hero, hero.abilities[0], [first]);

    const results = combat.resolveRound();
    assert.deepEqual(rattleResults(results).map((result) => result.source), [first, second]);
    assert.equal(second.isAlive(), false);
    assert.equal(hero.health, 75, "the second enemy's rattle hit the hero");
  });

  it('fire for deaths from damage over time at the end of the round', () => {
    const hero = makeHero();
    const doomed = makeEnemy({ health: 5, deathRattle: rattle() });
    doomed.addEffect(factory.createStatusEffect({
      name: 'Poison', icon: '☠️', type: 'damage_over_time', category: 'poison', magnitude: 10, duration: 2, schools: [], stat: null, tickSchool: 'nature',
    }));
    const combat = new Combat([hero], [doomed, makeEnemy()]);
    combat.queueAction(hero, hero.basicAttack, [combat.enemies[1]]);

    assert.equal(rattleResults(combat.resolveRound()).length, 1);
    assert.equal(hero.health, 90);
  });

  it('can target its killer', () => {
    const hero = killer();
    const otherHero = makeHero();
    const doomed = makeEnemy({ deathRattle: rattle({ target: 'killer', power: 30 }) });
    const combat = new Combat([otherHero, hero], [doomed, makeEnemy()]);
    combat.queueAction(hero, hero.abilities[0], [doomed]);

    combat.resolveRound();
    assert.equal(doomed.killedByUid, hero.uid);
    assert.equal(hero.health, 70, 'the killer was hit');
    assert.equal(otherHero.health, 100, 'nobody else was');
  });

  it('credits a damage-over-time kill to whoever applied the effect', () => {
    const poisonDef = {
      name: 'Poison', icon: '☠️', type: 'damage_over_time', category: 'poison', magnitude: 10, duration: 3, schools: [], stat: null, tickSchool: 'nature',
    };
    const poisoner = makeHero({ abilities: [ability({ name: 'Envenom', power: 0, effects: [{ type: 'status', status: poisonDef }] })] });
    const doomed = makeEnemy({ health: 5, deathRattle: rattle({ target: 'killer', power: 20 }) });
    const combat = new Combat([poisoner], [doomed, makeEnemy()]);
    combat.queueAction(poisoner, poisoner.abilities[0], [doomed]);

    combat.resolveRound();
    assert.equal(doomed.isAlive(), false, 'the poison tick at round end killed it');
    assert.equal(doomed.killedByUid, poisoner.uid);
    assert.equal(poisoner.health, 80);
  });

  it('fizzles when the killer is already dead', () => {
    const hero = killer();
    const first = makeEnemy({ deathRattle: rattle({ target: 'all_allies', power: 999 }) });
    const second = makeEnemy({ deathRattle: rattle({ target: 'killer', power: 50 }) }); // killed by `first`, who is dead
    const combat = new Combat([hero], [first, second, makeEnemy({ health: 2000 })]);
    combat.queueAction(hero, hero.abilities[0], [first]);

    const fired = rattleResults(combat.resolveRound());
    assert.equal(fired.length, 2);
    assert.match(fired[1].description, /no one left to hit/);
    assert.equal(hero.health, 100);
  });

  it('work for heroes too, and each clone keeps its own "fired" state', () => {
    const prototype = makeHero({ deathRattle: rattle({ target: 'all_enemies' }) });
    const fallen = prototype.clone();
    const survivor = makeHero();
    const enemy = makeEnemy({ attack: 0, abilities: [ability({ name: 'Crush', power: 999 })] });
    const combat = new Combat([fallen, survivor], [enemy]);
    combat.queueAction(survivor, survivor.basicAttack, [enemy]);
    combat.queueAction(enemy, enemy.abilities[0], [fallen]);
    combat.resolveRound();

    assert.equal(fallen.deathRattleFired, true);
    assert.equal(prototype.deathRattleFired, false);
    assert.ok(enemy.health < 100 - 10, "the fallen hero's rattle and the survivor's attack both landed");
  });
});

describe('Death rattle content', () => {
  it('is optional and defaults to none', () => {
    const { valid, value } = validateDefinition(heroDef());
    assert.ok(valid);
    assert.equal(value.deathRattle, null);
  });

  it('accepts group targets and drops cooldown and speed bonus', () => {
    const { valid, errors, value } = validateDefinition(enemyDef({ deathRattle: rattle({ target: 'everyone', cooldown: 5, priority: 9 }) }));
    assert.ok(valid, errors.join('; '));
    assert.equal(value.deathRattle.target, 'everyone');
    assert.equal(value.deathRattle.cooldown, 0);
    assert.equal(value.deathRattle.priority, 0);
  });

  it('rejects single-target death rattles', () => {
    const { valid, errors } = validateDefinition(heroDef({ deathRattle: rattle({ target: 'single_enemy' }) }));
    assert.equal(valid, false);
    assert.ok(errors.some((error) => error.startsWith('deathRattle.target')), errors.join('; '));
  });

  it('keeps "everyone" and "killer" for death rattles only', () => {
    for (const target of ['everyone', 'killer']) {
      assert.equal(validateDefinition(heroDef({ abilities: [ability({ target })] })).valid, false, target);
      assert.ok(validateDefinition(heroDef({ deathRattle: rattle({ target }) })).valid, target);
    }
  });

  it('builds into the engine character', () => {
    const { value } = validateDefinition(enemyDef({ deathRattle: rattle() }));
    const enemy = factory.createEnemy(value);
    assert.equal(enemy.deathRattle.name, 'Rattle');
    assert.equal(enemy.deathRattle.target, 'all_enemies');
  });

  it('raises the power rating when helpful and lowers it when a drawback', () => {
    const score = (deathRattle) => ratePower(validateDefinition(heroDef({ deathRattle })).value).score;
    const none = score(null);
    assert.ok(score(rattle({ power: 30 })) > none, 'damaging enemies is a bonus');
    assert.ok(score(rattle({ power: 30, target: 'all_allies' })) < none, 'damaging your own team is a drawback');
  });
});
