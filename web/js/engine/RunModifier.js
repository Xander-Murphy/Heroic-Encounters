
/**
 * A rule that changes a dungeon run (used by daily challenges).
 * Subclasses override only the hooks they care about.
 */
export class RunModifier {
  static id = 'abstract';

  constructor(params = {}) {
    this.params = params;
  }

  get label() {
    return '';
  }

  get description() {
    return '';
  }

  /** Called once, after the party is cloned for the run. */
  onPartyCreated(_party) {}

  /** Called for each encounter, after its enemies are built and scaled. */
  onEnemiesSpawned(_enemies, _run) {}

  /** Share of max health survivors recover between encounters. */
  restPercent(base) {
    return base;
  }

  toJSON() {
    return { id: this.constructor.id, params: this.params };
  }
}

export class EmpoweredEnemiesModifier extends RunModifier {
  static id = 'empowered';

  get label() {
    return 'Empowered Foes';
  }

  get description() {
    return `Enemies deal ${this.params.percent}% more damage.`;
  }

  onEnemiesSpawned(enemies) {
    enemies.forEach((enemy) => enemy.scale(1 + this.params.percent / 100));
  }
}

export class WoundedPartyModifier extends RunModifier {
  static id = 'wounded';

  get label() {
    return 'Battle-Worn';
  }

  get description() {
    return `Your heroes start at ${this.params.percent}% health.`;
  }

  onPartyCreated(party) {
    party.forEach((hero) => { hero.health = Math.max(1, Math.round(hero.maxHealth * this.params.percent / 100)); });
  }
}

export class NoRestModifier extends RunModifier {
  static id = 'no_rest';

  get label() {
    return 'No Respite';
  }

  get description() {
    return 'No healing between encounters.';
  }

  restPercent() {
    return 0;
  }
}

export class SwiftEnemiesModifier extends RunModifier {
  static id = 'swift';

  get label() {
    return 'Swift Foes';
  }

  get description() {
    return `Enemies gain +${this.params.amount} speed and often act first.`;
  }

  onEnemiesSpawned(enemies) {
    enemies.forEach((enemy) => { enemy.speed += this.params.amount; });
  }
}

export class GlassCannonModifier extends RunModifier {
  static id = 'glass_cannon';

  get label() {
    return 'Glass Cannons';
  }

  get description() {
    return `Heroes gain +${this.params.attack} attack but lose all defense.`;
  }

  onPartyCreated(party) {
    party.forEach((hero) => {
      hero.attack += this.params.attack;
      hero.defense = 0;
    });
  }
}

const MODIFIERS = [EmpoweredEnemiesModifier, WoundedPartyModifier, NoRestModifier, SwiftEnemiesModifier, GlassCannonModifier];

export function createModifier({ id, params }) {
  const ModifierClass = MODIFIERS.find((modifier) => modifier.id === id);
  if (!ModifierClass) throw new Error(`Unknown run modifier: ${id}`);
  return new ModifierClass(params);
}

/** Templates the daily challenge picks from. */
export const MODIFIER_POOL = Object.freeze([
  { id: 'empowered', params: { percent: 20 } },
  { id: 'wounded', params: { percent: 75 } },
  { id: 'no_rest', params: {} },
  { id: 'swift', params: { amount: 4 } },
  { id: 'glass_cannon', params: { attack: 12 } },
]);
