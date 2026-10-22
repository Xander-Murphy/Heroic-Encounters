import { achievementById } from './achievements.js';

/**
 * Decides whether the player may use a hero.
 *
 * Built-in heroes carry an `unlock` rule; anything the player made or
 * imported is always available (it's theirs). Each rule type is a small
 * strategy object, so a new kind of unlock is one new entry.
 */
const RULES = Object.freeze({
  default: {
    isMet: () => true,
    describe: () => 'Available from the start',
  },
  level: {
    isMet: (rule, profile) => profile.level >= rule.value,
    describe: (rule) => `Reach level ${rule.value}`,
  },
  achievement: {
    isMet: (rule, profile) => profile.hasAchievement(rule.value),
    describe: (rule) => `Earn "${achievementById(rule.value)?.name ?? rule.value}"`,
  },
});

export class UnlockPolicy {
  constructor(profile) {
    this.profile = profile;
  }

  #ruleFor(hero) {
    return RULES[hero.unlock?.type] ?? RULES.default;
  }

  isUnlocked(hero) {
    return this.#ruleFor(hero).isMet(hero.unlock ?? {}, this.profile);
  }

  requirement(hero) {
    return this.#ruleFor(hero).describe(hero.unlock ?? {});
  }
}
