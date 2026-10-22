import { ACHIEVEMENTS } from '../../progression/achievements.js';
import { h } from '../dom.js';

/** Renown / level progress bar for the player's profile. */
export function levelBar(profile) {
  const { level, intoLevel, needed } = profile.levelInfo;
  return h('div', { class: 'level-bar' },
    h('div', { class: 'level-badge', title: 'Level' }, level),
    h('div', { class: 'level-meta' },
      h('div', {}, h('b', {}, profile.data.playerName || 'Adventurer'), h('span', { class: 'muted' }, ` · ${profile.title}`)),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(needed), 'aria-valuenow': String(intoLevel), 'aria-label': 'Renown to next level' },
        h('div', { style: { width: `${(100 * intoLevel) / needed}%` } })),
      h('small', { class: 'muted' }, `${intoLevel} / ${needed} renown to level ${level + 1}`)));
}

export function progressBar(current, target, label = '') {
  return h('div', { class: 'progress small', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(target), 'aria-valuenow': String(current), 'aria-label': label },
    h('div', { style: { width: `${Math.min(100, (100 * current) / target)}%` } }));
}

/**
 * The few goals closest to completion: unlockable heroes and achievements
 * with progress (Business.md: "a clear sense of advancement").
 */
export function nextGoals(services, limit = 3) {
  const { profile, progression, library } = services;
  const context = progression.achievementContext();
  const goals = [];

  const lockedHero = library.heroes({ source: 'core' }).find((hero) => !progression.unlocks.isUnlocked(hero) && hero.unlock?.type === 'level');
  if (lockedHero) {
    const { level, intoLevel, needed } = profile.levelInfo;
    const levelsToGo = lockedHero.unlock.value - level;
    goals.push({
      icon: lockedHero.portrait,
      title: `Unlock ${lockedHero.name}`,
      text: levelsToGo === 1 ? `Reach level ${lockedHero.unlock.value}` : `Reach level ${lockedHero.unlock.value} (${levelsToGo} levels to go)`,
      current: levelsToGo === 1 ? intoLevel : 0,
      target: needed,
      weight: 2,
    });
  }

  for (const achievement of ACHIEVEMENTS) {
    if (profile.hasAchievement(achievement.id)) continue;
    const progress = achievement.progress(profile, context);
    if (!progress) continue;
    goals.push({ icon: achievement.icon, title: achievement.name, text: achievement.description, ...progress, weight: progress.current / progress.target });
  }

  return goals.sort((a, b) => b.weight - a.weight).slice(0, limit);
}

export function goalList(goals) {
  if (!goals.length) return h('p', { class: 'muted' }, 'You\'ve done it all. Time to build something new in the Workshop!');
  return h('ul', { class: 'goal-list' }, goals.map((goal) => h('li', {},
    h('span', { class: 'goal-icon', 'aria-hidden': 'true' }, goal.icon),
    h('div', {},
      h('b', {}, goal.title), h('div', { class: 'muted' }, goal.text),
      progressBar(goal.current, goal.target, goal.title),
      h('small', { class: 'muted' }, `${goal.current} / ${goal.target}`)))));
}

export function emptyState(icon, title, text, action = null) {
  return h('div', { class: 'empty-state' }, h('div', { class: 'empty-icon' }, icon), h('h3', {}, title), h('p', { class: 'muted' }, text), action);
}

/** Tab strip; onSelect(id) is called when a tab is clicked. */
export function tabs(items, selected, onSelect) {
  return h('div', { class: 'tabs', role: 'tablist' }, items.map((item) => h('button', {
    role: 'tab',
    class: ['tab', item.id === selected && 'active'],
    'aria-selected': String(item.id === selected),
    onclick: () => onSelect(item.id),
  }, item.label, item.count !== undefined ? h('span', { class: 'tab-count' }, item.count) : null)));
}
