import { Character } from './Character.js';
import { EffectResult } from './effects/EffectResult.js';
import { EnemyRank, ResultKind, Side } from './types.js';

/**
 * A monster the party fights. How it picks its moves is a separate
 * EnemyBehavior object (Strategy), so new enemy brains need no new Enemy class.
 */
export class Enemy extends Character {
  constructor({ behavior, rank = EnemyRank.MINION, enemyType = 'physical', ...rest }) {
    super({ ...rest, side: Side.ENEMY });
    this.behavior = behavior;
    this.rank = rank;
    this.enemyType = enemyType;
  }

  get isBoss() {
    return false;
  }

  get typeLine() {
    const rank = this.rank === EnemyRank.ELITE ? 'Elite ' : '';
    return `${rank}${this.enemyType === 'caster' ? 'Caster' : 'Brute'}`;
  }

  /** Grow stronger for later waves (attack only, so "hits to kill" stays the same). */
  scale(multiplier) {
    this.attack = Math.round(this.attack * multiplier);
    return this;
  }
}

/**
 * An enemy with phases: when its health first drops below a threshold it
 * gains a status effect (enrage, shield, ...) and announces it.
 */
export class Boss extends Enemy {
  constructor({ phases = [], ...rest }) {
    super({ ...rest, rank: EnemyRank.BOSS });
    // [{ atHealthPercent, message, status: StatusEffect }], highest threshold first
    this.phases = [...phases].sort((a, b) => b.atHealthPercent - a.atHealthPercent);
    this.triggeredPhases = 0;
  }

  get isBoss() {
    return true;
  }

  get typeLine() {
    return 'Boss';
  }

  checkPhaseTransitions() {
    const results = [];
    const percent = (100 * this.health) / this.maxHealth;

    while (
      this.isAlive()
      && this.triggeredPhases < this.phases.length
      && percent <= this.phases[this.triggeredPhases].atHealthPercent
    ) {
      const phase = this.phases[this.triggeredPhases];
      this.triggeredPhases += 1;
      if (phase.status) this.addEffect(phase.status.clone());
      results.push(new EffectResult({
        source: this, target: this, kind: ResultKind.PHASE,
        description: phase.message || `${this.name} enters a new phase!`,
      }));
    }
    return results;
  }
}
