import { ContentSource } from '../../content/ContentLibrary.js';
import { RunState } from '../../engine/DungeonRun.js';
import { h } from '../dom.js';
import { Screen } from '../Screen.js';
import { characterCard } from '../components/Card.js';
import { CombatLog } from '../components/CombatLog.js';
import { openShareDialog } from '../components/ShareDialogs.js';
import { levelBar } from '../components/widgets.js';

/** End of a run: result, rewards earned, statistics and the full battle log. */
export class SummaryScreen extends Screen {
  static nav = 'play';
  static title = 'Run summary';
  static historyEnabled = false;

  render() {
    const { run, report } = this.params;
    if (!run) return h('div', { class: 'panel' }, h('p', {}, 'Nothing to show.'), h('button', { onclick: () => this.app.navigate('home') }, 'Home'));

    const won = run.state === RunState.WON;
    const { stats } = run;
    return [
      h('div', { class: ['result-banner', won ? 'victory' : 'defeat'] },
        h('h1', {}, won ? 'Victory!' : 'Defeat'),
        h('p', {}, won ? `${run.dungeon.name} has been cleared.` : `Your party fell in ${run.dungeon.name} (${run.waveLabel}).`)),
      h('div', { class: 'summary-grid' },
        h('div', { class: 'panel' }, h('h2', {}, 'Rewards'), this.#rewards(report)),
        h('div', { class: 'panel' }, h('h2', {}, 'Battle report'),
          h('div', { class: 'stat-row wrap' },
            this.#stat(stats.rounds, 'rounds'),
            this.#stat(stats.enemiesDefeated, 'enemies defeated'),
            this.#stat(stats.damageDealt, 'damage dealt'),
            this.#stat(stats.damageTaken, 'damage taken'),
            this.#stat(stats.healingDone, 'healing done'),
            this.#stat(run.heroesLost(), 'heroes lost')),
          h('div', { class: 'card-row small-cards' }, run.party.map((hero) => characterCard(hero, { classes: 'small' }))),
          this.#communityActions(run))),
      h('div', { class: 'row' },
        h('button', { class: 'primary big', onclick: () => this.#again(run) }, run.tags.daily ? 'Retry daily' : 'Run it again'),
        h('button', { class: 'big', onclick: () => this.app.navigate('play') }, 'Change party'),
        h('button', { class: 'big', onclick: () => this.app.navigate('home') }, 'Home')),
      h('h2', {}, 'Battle log'),
      new CombatLog({ entries: run.log, large: true, showLatest: false }).render(),
    ];
  }

  #stat(value, label) {
    return h('div', { class: 'stat' }, h('b', {}, value), h('small', {}, label));
  }

  #rewards(report) {
    const { profile } = this.services;
    return h('div', {},
      h('ul', { class: 'reward-lines' },
        report.lines.map((line) => h('li', {}, h('span', {}, line.label), h('b', {}, `+${line.amount}`))),
        h('li', { class: 'total' }, h('span', {}, 'Total renown'), h('b', {}, `+${report.renown}`))),
      levelBar(profile),
      report.levelsGained ? h('p', { class: 'celebrate' }, `⭐ Level up! You are now level ${report.level}.`) : null,
      report.dailyWon ? h('p', { class: 'celebrate' }, `📅 Daily challenge complete — ${report.streak}-day streak!`) : null,
      report.achievements.length ? h('div', {}, h('h3', {}, 'Achievements'), h('ul', { class: 'achievement-mini' },
        report.achievements.map((achievement) => h('li', {}, h('span', {}, achievement.icon), ' ', h('b', {}, achievement.name), h('span', { class: 'muted' }, ` — ${achievement.description}`))))) : null,
      report.heroesUnlocked.length ? h('div', {}, h('h3', {}, 'New heroes unlocked!'),
        h('div', { class: 'card-row small-cards' }, report.heroesUnlocked.map((hero) => characterCard(this.services.library.instantiate(hero.id), { classes: 'small' })))) : null);
  }

  #communityActions(run) {
    const { library, api, profile } = this.services;
    const meta = library.meta(run.dungeon.id);
    if (meta?.source === ContentSource.CREATED) {
      return h('div', { class: 'callout' }, h('p', {}, 'This is your dungeon. Think it\'s a good challenge? Share it!'),
        h('button', { onclick: () => openShareDialog(this.app, run.dungeon.id) }, '🎁 Share this dungeon'));
    }
    if (meta?.source === ContentSource.IMPORTED && meta.origin?.code && api.available) {
      const like = h('button', {
        onclick: async () => {
          like.disabled = true;
          try {
            const { likes } = await api.like(meta.origin.code, profile.data.installId);
            like.textContent = `👍 Liked (${likes})`;
          } catch (error) {
            this.app.toaster.error(error.message);
            like.disabled = false;
          }
        },
      }, '👍 Like this dungeon');
      return h('div', { class: 'callout' }, h('p', {}, `Made by ${run.dungeon.author || meta.origin.author || 'another player'}. Let them know you enjoyed it.`), like);
    }
    return null;
  }

  #again(run) {
    const { library } = this.services;
    const heroIds = run.party.map((hero) => hero.contentId);
    if (run.tags.daily) this.app.session.startDaily();
    else if (heroIds.every((id) => library.has(id)) && library.has(run.dungeon.id)) this.app.session.startRun({ dungeonId: run.dungeon.id, heroIds });
    else {
      this.app.navigate('play');
      return;
    }
    this.app.navigate('combat');
  }
}
