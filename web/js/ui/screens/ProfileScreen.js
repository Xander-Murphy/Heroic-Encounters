import { localMetrics } from '../../insights/Insights.js';
import { ContentSource } from '../../content/ContentLibrary.js';
import { ACHIEVEMENTS } from '../../progression/achievements.js';
import { MASTERY } from '../../progression/Profile.js';
import { h, percent } from '../dom.js';
import { Screen, screenHeader } from '../Screen.js';
import { characterCard } from '../components/Card.js';
import { levelBar, progressBar, tabs } from '../components/widgets.js';

const CATEGORY_LABELS = { combat: '⚔️ Combat', collection: '📜 Collection', daily: '📅 Daily', community: '🌐 Community' };

/** Achievements, hero collection with mastery, enemy codex and personal stats. */
export class ProfileScreen extends Screen {
  static nav = 'profile';
  static title = 'Profile';

  enter() {
    this.tab = this.params.tab ?? 'achievements';
  }

  render() {
    const { profile } = this.services;
    const earned = ACHIEVEMENTS.filter((achievement) => profile.hasAchievement(achievement.id)).length;
    const views = {
      achievements: () => this.#achievements(),
      heroes: () => this.#heroes(),
      codex: () => this.#codex(),
      stats: () => this.#stats(),
    };
    return [
      screenHeader('Profile', `${profile.renown} renown earned in total`),
      h('div', { class: 'panel' }, levelBar(profile)),
      tabs([
        { id: 'achievements', label: 'Achievements', count: `${earned}/${ACHIEVEMENTS.length}` },
        { id: 'heroes', label: 'Heroes' },
        { id: 'codex', label: 'Codex', count: profile.codexCount() },
        { id: 'stats', label: 'Stats' },
      ], this.tab, (id) => { this.tab = id; this.refresh(); }),
      views[this.tab](),
    ];
  }

  #achievements() {
    const { profile, progression } = this.services;
    const context = progression.achievementContext();
    return Object.entries(CATEGORY_LABELS).map(([category, label]) => h('section', {},
      h('h2', {}, label),
      h('div', { class: 'achievement-grid' }, ACHIEVEMENTS.filter((achievement) => achievement.category === category).map((achievement) => {
        const earnedAt = profile.data.achievements[achievement.id];
        const progress = earnedAt ? null : achievement.progress(profile, context);
        return h('div', { class: ['achievement', earnedAt ? 'earned' : 'locked'] },
          h('div', { class: 'achievement-icon' }, achievement.icon),
          h('div', {},
            h('b', {}, achievement.name),
            h('div', { class: 'muted' }, achievement.description),
            earnedAt ? h('small', { class: 'earned-date' }, `Earned ${new Date(earnedAt).toLocaleDateString()}`) : null,
            progress ? [progressBar(progress.current, progress.target, achievement.name), h('small', { class: 'muted' }, `${progress.current} / ${progress.target}`)] : null,
            h('small', { class: 'reward' }, `+${achievement.renown} renown`)));
      }))));
  }

  #heroes() {
    const { library, progression, profile } = this.services;
    const cards = library.heroes({ source: ContentSource.CORE }).map((definition) => {
      const available = progression.isHeroAvailable(definition);
      const mastery = profile.masteryFor(definition.id);
      const record = profile.data.heroStats[definition.id] ?? { runs: 0, wins: 0 };
      const nextTier = MASTERY.find((tier) => record.wins < tier.wins);
      return h('div', { class: 'roster-cell' },
        characterCard(library.instantiate(definition.id), {
          locked: !available,
          lockText: available ? null : progression.unlocks.requirement(definition),
          badge: mastery ? { text: mastery.icon, title: `${mastery.label} mastery` } : null,
        }),
        available ? h('small', { class: 'card-caption' }, `${record.wins} clears / ${record.runs} runs`, nextTier ? ` · ${nextTier.icon} at ${nextTier.wins}` : ' · max mastery') : null);
    });
    return h('div', {},
      h('p', { class: 'muted' }, 'Clear dungeons with a hero to earn mastery: 🥉 1 clear, 🥈 5 clears, 🥇 15 clears.'),
      h('div', { class: 'card-grid' }, cards));
  }

  #codex() {
    const { library, profile } = this.services;
    const dungeons = library.dungeons({ source: ContentSource.CORE });
    return dungeons.map((dungeon) => {
      const ids = library.dependenciesOf(dungeon);
      const seen = ids.filter((id) => profile.hasSeenEnemy(id)).length;
      return h('section', {},
        h('h2', {}, `${dungeon.icon} ${dungeon.name}`, h('span', { class: 'muted' }, ` — ${seen}/${ids.length} discovered`)),
        h('div', { class: 'card-row small-cards codex-row' }, ids.map((id) => (profile.hasSeenEnemy(id)
          ? h('div', { class: 'roster-cell' }, characterCard(library.instantiate(id), { classes: 'small' }), h('small', { class: 'card-caption' }, `Encountered ${profile.data.codex[id]}×`))
          : h('div', { class: 'codex-unknown', 'aria-label': 'Undiscovered enemy' }, h('span', {}, '❔'), h('small', {}, 'Undiscovered'))))));
    });
  }

  #stats() {
    const { profile, progression, library } = this.services;
    const coreHeroes = library.heroes({ source: ContentSource.CORE });
    const metrics = localMetrics(profile, coreHeroes.filter((hero) => progression.unlocks.isUnlocked(hero)).length, coreHeroes.length);
    const row = (label, value) => h('tr', {}, h('th', { scope: 'row' }, label), h('td', {}, value));

    return h('div', { class: 'stats-layout' },
      h('div', { class: 'panel' }, h('h2', {}, 'Lifetime'), h('table', { class: 'stats-table' }, h('tbody', {},
        row('Days played', metrics.daysPlayed),
        row('Runs started', metrics.runsStarted),
        row('Runs that reached the boss', percent(metrics.runCompletion)),
        row('Win rate', percent(metrics.winRate)),
        row('Bosses defeated', profile.stat('bossesDefeated')),
        row('Flawless clears', profile.stat('flawless')),
        row('Enemies defeated', profile.stat('enemiesDefeated')),
        row('Damage dealt', profile.stat('damageDealt')),
        row('Healing done', profile.stat('healingDone')),
        row('Heroes unlocked', `${metrics.heroesUnlocked} / ${metrics.totalHeroes}`),
        row('Daily streak (best)', `${profile.currentStreak()} (${profile.data.daily.best})`),
        row('Creations / shares / imports', `${profile.stat('created')} / ${profile.stat('shared')} / ${profile.stat('imported')}`)))),
      h('div', { class: 'panel' }, h('h2', {}, 'Dungeon records'), h('table', { class: 'stats-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Dungeon'), h('th', {}, 'Clears'), h('th', {}, 'Best'))),
        h('tbody', {}, library.dungeons().map((dungeon) => {
          const record = profile.dungeonRecord(dungeon.id);
          return h('tr', {}, h('th', { scope: 'row' }, `${dungeon.icon} ${dungeon.name}`), h('td', {}, `${record.wins}/${record.runs}`), h('td', {}, record.bestRounds ? `${record.bestRounds} rounds` : '—'));
        })))));
  }
}
