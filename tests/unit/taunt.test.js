import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CORE_HEROES } from '../../web/js/content/core/heroes.js';
import { validateDefinition } from '../../web/js/content/schema.js';
import { Combat } from '../../web/js/engine/Combat.js';
import { resolverFor } from '../../web/js/engine/targeting.js';
import {
  ability, factory, heroDef, makeEnemy, makeHero,
} from '../helpers.js';

const tauntStatus = () => ({ name: 'Taunted', icon: '📣', type: 'taunt', category: 'physical', magnitude: 0, duration: 2, schools: [], stat: null, tickSchool: null });
const guardStatus = () => ({ name: 'Guarded', icon: '🧱', type: 'buff', category: 'physical', magnitude: 4, duration: 2, schools: [], stat: 'defense', tickSchool: null });

/** Taunt one enemy. */
const taunt = () => ability({ name: 'Taunt', power: 0, target: 'single_enemy', priority: 10, effects: [{ type: 'status', status: tauntStatus() }] });
/** Taunt every enemy, and give the caster +4 defense. */
const aoeTaunt = () => ability({
  name: 'AoE Taunt', power: 0, target: 'all_enemies', priority: 10,
  effects: [{ type: 'status', status: tauntStatus() }, { type: 'status', status: guardStatus(), self: true }],
});

const attackOptions = (attacker, combat) => resolverFor('single_enemy').candidates(attacker, combat.battlefield);

/** Build a hero through validation, as content from the editor would be. */
const validHero = (overrides) => factory.createHero(validateDefinition(heroDef(overrides)).value);

describe('Taunt (one enemy)', () => {
  it('forces that enemy to attack only the caster', () => {
    const tank = makeHero({ abilities: [taunt()] });
    const healer = makeHero();
    const [taunted, other] = [makeEnemy(), makeEnemy()];
    const combat = new Combat([tank, healer], [taunted, other]);
    combat.queueAction(tank, tank.abilities[0], [taunted]);
    combat.resolveRound();

    assert.deepEqual(attackOptions(taunted, combat), [tank]);
    assert.deepEqual(attackOptions(other, combat), [tank, healer], 'other enemies are free to choose');
  });

  it('stops forcing anything once the caster dies', () => {
    const tank = makeHero({ abilities: [taunt()] });
    const healer = makeHero();
    const enemy = makeEnemy();
    const combat = new Combat([tank, healer], [enemy, makeEnemy()]);
    combat.queueAction(tank, tank.abilities[0], [enemy]);
    combat.resolveRound();
    tank.loseHealth(999);

    assert.deepEqual(attackOptions(enemy, combat), [healer]);
  });

  it('follows the most recent taunter when two characters taunt the same enemy', () => {
    const first = makeHero({ speed: 9, abilities: [taunt()] });
    const second = makeHero({ speed: 2, abilities: [taunt()] });
    const enemy = makeEnemy();
    const combat = new Combat([first, second], [enemy, makeEnemy()]);
    combat.queueAction(first, first.abilities[0], [enemy]);
    combat.queueAction(second, second.abilities[0], [enemy]);
    combat.resolveRound();

    assert.deepEqual(attackOptions(enemy, combat), [second]);
  });

  it('wears off after its duration', () => {
    const tank = makeHero();
    const enemy = makeEnemy();
    const status = factory.createStatusEffect(tauntStatus());
    status.sourceUid = tank.uid;
    enemy.addEffect(status);
    enemy.endRound();
    enemy.endRound();
    assert.equal(enemy.forcedTargetUid(), null);
  });

  it('is a harmful effect that cleanses can remove', () => {
    assert.equal(factory.createStatusEffect(tauntStatus()).isHarmful, true);
  });
});

describe('AoE Taunt (all enemies)', () => {
  it('forces every enemy to attack the caster, and buffs only the caster', () => {
    const tank = validHero({ abilities: [aoeTaunt()] });
    const healer = makeHero();
    const enemies = [makeEnemy(), makeEnemy()];
    const combat = new Combat([tank, healer], enemies);
    combat.queueAction(tank, tank.abilities[0], enemies);
    combat.resolveRound();

    for (const enemy of enemies) {
      assert.deepEqual(attackOptions(enemy, combat), [tank]);
      assert.equal(enemy.getStat('defense'), 0, "the caster's buff didn't go to the enemies");
    }
    assert.equal(tank.getStat('defense'), 4);
    assert.equal(tank.activeEffects.length, 1, 'the caster buff is applied once, not once per enemy');
  });

  it('is what the built-in Challenge does', () => {
    const thorne = CORE_HEROES.find((hero) => hero.abilities.some((each) => each.id === 'challenge'));
    const challenge = factory.createHero(validateDefinition(thorne).value).abilities.find((each) => each.id === 'challenge');
    assert.equal(challenge.target, 'all_enemies');
    assert.deepEqual(challenge.effects.map((effect) => effect.appliesToSelf), [false, true]);
  });
});

describe('Caster-only effects in content', () => {
  it('validate, and only store "self" when it is set', () => {
    const { valid, errors, value } = validateDefinition(heroDef({ abilities: [aoeTaunt()] }));
    assert.ok(valid, errors.join('; '));
    assert.equal(value.abilities[0].effects[0].self, undefined);
    assert.equal(value.abilities[0].effects[1].self, true);
  });

  it('are dropped from death rattles, whose caster is dead', () => {
    const deathRattle = { ...aoeTaunt(), name: 'Last Taunt' };
    const { value } = validateDefinition(heroDef({ deathRattle }));
    assert.equal(value.deathRattle.effects[1].self, undefined);
  });
});

describe('Old-style taunts (saved before taunts moved onto the enemy)', () => {
  const oldTaunt = () => ability({
    name: 'Provoke', power: 0, target: 'self', priority: 10,
    effects: [{ type: 'status', status: tauntStatus() }, { type: 'status', status: guardStatus() }],
  });

  it('are converted into an AoE taunt that keeps its other effects on the caster', () => {
    const { valid, value } = validateDefinition(heroDef({ abilities: [oldTaunt()] }));
    assert.ok(valid);
    const [migrated] = value.abilities;
    assert.equal(migrated.target, 'all_enemies');
    assert.equal(migrated.effects[0].self, undefined, 'the taunt goes on the enemies');
    assert.equal(migrated.effects[1].self, true, 'the defense buff stays on the caster');
  });

  it('still protect allies in combat', () => {
    const tank = validHero({ abilities: [oldTaunt()] });
    const healer = makeHero();
    const enemy = makeEnemy();
    const combat = new Combat([tank, healer], [enemy, makeEnemy()]);
    combat.queueAction(tank, tank.abilities[0], combat.enemies);
    combat.resolveRound();
    assert.deepEqual(attackOptions(enemy, combat), [tank]);
    assert.equal(tank.getStat('defense'), 4);
  });

  it('leave other self-cast abilities alone', () => {
    const { value } = validateDefinition(heroDef({ abilities: [ability({ name: 'Brace', power: 0, target: 'self', effects: [{ type: 'status', status: guardStatus() }] })] }));
    assert.equal(value.abilities[0].target, 'self');
    assert.equal(value.abilities[0].effects[0].self, undefined);
  });
});

describe('Taunts take effect in the round they are cast', () => {
  it('redirects an attack already aimed at someone else this round', () => {
    const tank = makeHero({ speed: 9, abilities: [taunt()] });
    const healer = makeHero({ speed: 1 });
    const enemy = makeEnemy({ speed: 5 });
    const combat = new Combat([tank, healer], [enemy, makeEnemy({ speed: 1 })]);
    combat.queueAction(enemy, enemy.abilities[0], [healer]); // planned before the taunt
    combat.queueAction(tank, tank.abilities[0], [enemy]);

    const results = combat.resolveRound();
    assert.equal(healer.health, 100, 'the healer was spared');
    assert.equal(tank.health, 80, 'the tank took the hit');
    const redirect = results.find((result) => result.kind === 'redirect');
    assert.equal(redirect?.source, enemy);
    assert.match(redirect.description, /taunted into attacking/);
  });

  it('AoE Taunt redirects every enemy this round', () => {
    const tank = validHero({ speed: 9, abilities: [aoeTaunt()] });
    const healer = makeHero({ speed: 1 });
    const enemies = [makeEnemy({ speed: 5 }), makeEnemy({ speed: 4 })];
    const combat = new Combat([tank, healer], enemies);
    for (const enemy of enemies) combat.queueAction(enemy, enemy.abilities[0], [healer]);
    combat.queueAction(tank, tank.abilities[0], enemies);

    combat.resolveRound();
    assert.equal(healer.health, 100);
    assert.ok(tank.health < 100);
  });

  it("doesn't affect attacks that already happened earlier in the round", () => {
    const tank = makeHero({ speed: 1, abilities: [taunt()] });
    const healer = makeHero();
    const enemy = makeEnemy({ speed: 15 }); // beats the taunt's 1 speed + 10 bonus
    const combat = new Combat([tank, healer], [enemy, makeEnemy({ speed: 1 })]);
    combat.queueAction(enemy, enemy.abilities[0], [healer]); // faster than the taunt
    combat.queueAction(tank, tank.abilities[0], [enemy]);

    const results = combat.resolveRound();
    assert.equal(healer.health, 80);
    assert.equal(results.some((result) => result.kind === 'redirect'), false);
  });

  it("doesn't redirect area attacks or heals", () => {
    const tank = makeHero({ speed: 9, abilities: [taunt()] });
    const healer = makeHero({ speed: 1 });
    const blaster = makeEnemy({ speed: 5, abilities: [ability({ name: 'Blast', target: 'all_enemies' })] });
    const combat = new Combat([tank, healer], [blaster, makeEnemy({ speed: 1 })]);
    combat.queueAction(blaster, blaster.abilities[0], [tank, healer]);
    combat.queueAction(tank, tank.abilities[0], [blaster]);

    combat.resolveRound();
    assert.equal(healer.health, 80, 'area attacks still hit everyone');
  });
});
