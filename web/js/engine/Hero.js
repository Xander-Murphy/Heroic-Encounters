import { Character } from './Character.js';
import { Side } from './types.js';

/** A playable character. Adds a class, specialization and party role. */
export class Hero extends Character {
  constructor({ className = 'Adventurer', specialization = '', role = 'damage', ...rest }) {
    super({ ...rest, side: Side.HERO });
    this.className = className;
    this.specialization = specialization;
    this.role = role;
  }

  get typeLine() {
    return this.specialization ? `${this.className} · ${this.specialization}` : this.className;
  }
}
