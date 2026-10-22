import { Action } from './Action.js';
import { ActionQueue } from './ActionQueue.js';
import { EffectResult } from './effects/EffectResult.js';
import { Random } from './Random.js';
import { Battlefield } from './targeting.js';
import { ResultKind } from './types.js';

/**
 * One fight between the party and a group of enemies.
 *
 * Runs in rounds. During a round each character who can act may queue one
 * action: the player queues the heroes' actions, and planEnemyActions() asks
 * each enemy's behavior for theirs (before the player chooses, so enemy
 * intents can be shown). The round then resolves fastest-first, followed by
 * round-end upkeep (damage/heal over time, effect durations, cooldowns).
 *
 * Resolution is available in steps (beginRound / executeNextAction /
 * finishRound) so the UI can animate each action, or in one call
 * (resolveRound) for tests and simulations.
 *
 * Ties in priority go to the heroes, then to whoever queued first.
 * This class knows nothing about the DOM, so it runs in Node for tests.
 */
export class Combat {
  #queue = new ActionQueue();
  #resolving = false;

  constructor(heroes, enemies, { rng = new Random() } = {}) {
    this.battlefield = new Battlefield(heroes, enemies);
    this.rng = rng;
    this.roundNumber = 1;
  }

  // --- Who is in the fight ------------------------------------------------

  get heroes() {
    return this.battlefield.heroes;
  }

  get enemies() {
    return this.battlefield.enemies;
  }

  get everyone() {
    return [...this.heroes, ...this.enemies];
  }

  livingHeroes() {
    return this.heroes.filter((hero) => hero.isAlive());
  }

  livingEnemies() {
    return this.enemies.filter((enemy) => enemy.isAlive());
  }

  isOver() {
    return this.livingHeroes().length === 0 || this.livingEnemies().length === 0;
  }

  heroesWon() {
    return this.isOver() && this.livingHeroes().length > 0;
  }

  get isResolving() {
    return this.#resolving;
  }

  // --- Planning the round -------------------------------------------------

  queuedActions() {
    return this.#queue.actions;
  }

  actionFor(actor) {
    return this.#queue.find((action) => action.actor === actor);
  }

  heroesAwaitingOrders() {
    return this.heroes.filter((hero) => hero.canAct() && this.actionFor(hero) === null);
  }

  isReadyToResolve() {
    return !this.isOver() && !this.#resolving && this.heroesAwaitingOrders().length === 0;
  }

  canQueue(actor, ability) {
    return this.#canAct(actor, ability) && this.actionFor(actor) === null;
  }

  /** Queue an action. Returns the Action, or null if it isn't allowed. */
  queueAction(actor, ability, targets) {
    return this.addAction(new Action(actor, ability, targets));
  }

  /** Queue a ready-made Action, applying the same rules as queueAction. */
  addAction(action) {
    if (!this.canQueue(action.actor, action.ability) || !action.hasLivingTarget()) return null;
    this.#queue.add(action);
    return action;
  }

  cancelAction(actor) {
    const action = this.actionFor(actor);
    if (action) this.#queue.remove(action);
    return action;
  }

  /**
   * Queue an action, swapping out any the actor already has. If the new
   * action isn't allowed, nothing changes. Returns the new Action, or null.
   */
  replaceAction(actor, ability, targets) {
    const action = new Action(actor, ability, targets);
    if (!this.#canAct(actor, ability) || !action.hasLivingTarget()) return null;
    this.cancelAction(actor);
    return this.addAction(action);
  }

  /** Every enemy that can act and has no orders yet chooses its action. */
  planEnemyActions() {
    const planned = [];
    for (const enemy of this.livingEnemies()) {
      if (!enemy.canAct() || this.actionFor(enemy)) continue;
      const choice = enemy.behavior?.chooseAction(enemy, this.battlefield, this.rng);
      const action = choice ? this.addAction(choice) : null;
      if (action) planned.push(action);
    }
    return planned;
  }

  #canAct(actor, ability) {
    return !this.isOver() && !this.#resolving && this.battlefield.includes(actor)
      && actor.canAct() && actor.canUse(ability);
  }

  // --- Resolving the round, step by step ----------------------------------

  /** Lock in the queued actions and sort them into turn order. */
  beginRound() {
    if (this.isOver() || this.#resolving) return false;
    this.#queue.sort((action) => (action.actor.isHero ? 0 : 1));
    this.#resolving = true;
    return true;
  }

  /** Perform the next queued action. Returns { action, results } or null when done. */
  executeNextAction() {
    if (!this.#resolving) return null;

    while (!this.isOver()) {
      const action = this.#queue.next();
      if (!action) return null;
      if (!action.actor.isAlive()) continue;

      if (!action.actor.canAct()) {
        return {
          action,
          results: [new EffectResult({
            source: action.actor, target: action.actor, kind: ResultKind.SKIP,
            description: `${action.actor.name} is stunned and loses their turn`,
          })],
        };
      }

      action.retarget(this.battlefield);
      if (!action.canExecute()) continue;

      const results = action.execute();
      for (const character of this.everyone) {
        results.push(...character.checkPhaseTransitions());
      }
      return { action, results };
    }
    return null;
  }

  /** Round-end upkeep. Returns the upkeep EffectResults. */
  finishRound() {
    if (!this.#resolving) return [];
    this.#queue.clear();
    this.#resolving = false;

    if (this.isOver()) return [];

    const results = [];
    for (const character of this.everyone) {
      if (character.isAlive()) results.push(...character.endRound());
    }
    for (const character of this.everyone) {
      results.push(...character.checkPhaseTransitions());
    }
    if (!this.isOver()) this.roundNumber += 1;
    return results;
  }

  /** Resolve the whole round at once. Returns every EffectResult in order. */
  resolveRound() {
    if (!this.beginRound()) return [];
    const results = [];
    let step;
    while ((step = this.executeNextAction()) !== null) results.push(...step.results);
    results.push(...this.finishRound());
    return results;
  }
}
