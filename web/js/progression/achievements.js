/**
 * Achievements are goals beyond "win the next fight" (Business.md, Mom Test:
 * "Rewards/achievements", "Story or other goals than just playing the game").
 *
 * Each one is a small object that answers isEarned(profile, context) from the
 * profile's recorded state, so they are checked the same way no matter which
 * event triggered the check. New achievements are new entries; the tracker
 * never changes (Open/Closed).
 */
export class Achievement {
  constructor({ id, name, description, icon, renown = 50, category = 'combat', condition, progress = null }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.icon = icon;
    this.renown = renown;
    this.category = category;
    this.condition = condition;
    this.progressFn = progress;
  }

  isEarned(profile, context) {
    return this.condition(profile, context);
  }

  /** { current, target } for achievements with a counter, else null. */
  progress(profile, context) {
    return this.progressFn ? this.progressFn(profile, context) : null;
  }
}

const counter = (statKey, target) => ({
  condition: (profile) => profile.stat(statKey) >= target,
  progress: (profile) => ({ current: Math.min(target, profile.stat(statKey)), target }),
});

export const ACHIEVEMENTS = Object.freeze([
  // Combat and progression
  new Achievement({ id: 'first_blood', name: 'First Blood', icon: '⚔️', renown: 25, description: 'Defeat your first enemy.', ...counter('enemiesDefeated', 1) }),
  new Achievement({ id: 'first_clear', name: 'Dungeon Delver', icon: '🏆', renown: 100, description: 'Defeat a dungeon boss. Unlocks Ysolde.', ...counter('bossesDefeated', 1) }),
  new Achievement({ id: 'flawless', name: 'Nobody Left Behind', icon: '💎', renown: 100, description: 'Clear a dungeon without losing a hero.', ...counter('flawless', 1) }),
  new Achievement({ id: 'slayer_100', name: 'Monster Hunter', icon: '🗡️', renown: 75, description: 'Defeat 100 enemies.', ...counter('enemiesDefeated', 100) }),
  new Achievement({ id: 'veteran_10', name: 'Seasoned', icon: '🎖️', renown: 75, description: 'Finish 10 dungeon runs, win or lose.', ...counter('runsFinished', 10) }),
  new Achievement({
    id: 'all_core_dungeons', name: 'Cartographer', icon: '🗺️', renown: 150, category: 'combat',
    description: 'Clear every built-in dungeon.',
    condition: (profile, { coreDungeonIds }) => coreDungeonIds.every((id) => profile.hasCleared(id)),
    progress: (profile, { coreDungeonIds }) => ({ current: coreDungeonIds.filter((id) => profile.hasCleared(id)).length, target: coreDungeonIds.length }),
  }),
  new Achievement({
    id: 'collector', name: 'Full Roster', icon: '📜', renown: 150, category: 'collection',
    description: 'Unlock every built-in hero.',
    condition: (profile, { coreHeroIds, isUnlocked }) => coreHeroIds.every(isUnlocked),
    progress: (profile, { coreHeroIds, isUnlocked }) => ({ current: coreHeroIds.filter(isUnlocked).length, target: coreHeroIds.length }),
  }),
  new Achievement({
    id: 'bestiary_15', name: 'Bestiary', icon: '📖', renown: 75, category: 'collection',
    description: 'Encounter 15 different enemies.',
    condition: (profile) => profile.codexCount() >= 15,
    progress: (profile) => ({ current: Math.min(15, profile.codexCount()), target: 15 }),
  }),
  new Achievement({
    id: 'mastery_gold', name: 'Signature Hero', icon: '🥇', renown: 150, category: 'collection',
    description: 'Earn gold mastery (15 clears) with one hero.',
    condition: (profile) => Object.values(profile.data.heroStats).some((entry) => entry.wins >= 15),
  }),

  // Daily challenge (return visits)
  new Achievement({ id: 'daily_first', name: 'Daily Grind', icon: '📅', renown: 50, category: 'daily', description: 'Win a daily challenge.', condition: (profile) => profile.data.daily.best >= 1 }),
  new Achievement({
    id: 'streak_3', name: 'On a Roll', icon: '🔥', renown: 100, category: 'daily', description: 'Win the daily challenge 3 days in a row.',
    condition: (profile) => profile.data.daily.best >= 3,
    progress: (profile) => ({ current: Math.min(3, profile.data.daily.best), target: 3 }),
  }),
  new Achievement({
    id: 'streak_7', name: 'Unstoppable', icon: '🌟', renown: 250, category: 'daily', description: 'Win the daily challenge 7 days in a row.',
    condition: (profile) => profile.data.daily.best >= 7,
    progress: (profile) => ({ current: Math.min(7, profile.data.daily.best), target: 7 }),
  }),

  // Creating and sharing (community)
  new Achievement({ id: 'creator', name: 'Creator', icon: '🛠️', renown: 50, category: 'community', description: 'Create your own hero, enemy or dungeon.', ...counter('created', 1) }),
  new Achievement({ id: 'architect', name: 'Dungeon Architect', icon: '🏰', renown: 75, category: 'community', description: 'Create your own dungeon.', ...counter('createdDungeons', 1) }),
  new Achievement({ id: 'generous', name: 'Generous', icon: '🎁', renown: 50, category: 'community', description: 'Share something you made with a friend or the community.', ...counter('shared', 1) }),
  new Achievement({ id: 'guest', name: 'Honored Guest', icon: '🤝', renown: 50, category: 'community', description: 'Import a hero, enemy or dungeon from someone else.', ...counter('imported', 1) }),
  new Achievement({ id: 'community_clear', name: 'Fresh Challenge', icon: '🧭', renown: 100, category: 'community', description: 'Clear a dungeon made by another player.', ...counter('communityClears', 1) }),
]);

export const achievementById = (id) => ACHIEVEMENTS.find((achievement) => achievement.id === id) ?? null;
