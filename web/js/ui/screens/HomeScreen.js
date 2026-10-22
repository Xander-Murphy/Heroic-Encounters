import { h } from '../dom.js';
import { Screen } from '../Screen.js';
import { goalList, levelBar, nextGoals } from '../components/widgets.js';

/** Landing screen: player progress, today's daily challenge, next goals and quick links. */
export class HomeScreen extends Screen {
  static nav = 'home';

  render() {
    const { profile } = this.services;
    const run = this.app.session.run;
    return [
      run && !run.isOver ? h('div', { class: 'callout resume' },
        h('span', {}, `Your party is still in ${run.dungeon.name} (${run.waveLabel}).`),
        h('button', { class: 'primary', onclick: () => this.app.navigate('combat') }, 'Resume run')) : null,
      h('div', { class: 'hero-banner' },
        h('h1', { class: 'title' }, 'Heroic Encounters'),
        h('p', { class: 'tagline' }, 'Build a party of three. Brave the dungeon. Share your legends.'),
        h('div', { class: 'row' }, h('button', { class: 'primary big', onclick: () => this.app.navigate('play') }, '⚔️ Play'))),
      h('div', { class: 'home-grid' },
        h('div', { class: 'panel' }, h('h2', {}, 'Your journey'), levelBar(profile), this.#namePrompt(), this.#records()),
        this.#dailyPanel(),
        h('div', { class: 'panel' }, h('h2', {}, 'Next goals'), goalList(nextGoals(this.services))),
        h('div', { class: 'panel' },
          h('h2', {}, 'Make it yours'),
          h('p', {}, 'Design heroes, monsters and whole dungeons, then send them to friends with a share string or community code.'),
          h('div', { class: 'row-left' },
            h('button', { onclick: () => this.app.navigate('edit-hero') }, '🦸 Create a hero'),
            h('button', { onclick: () => this.app.navigate('edit-dungeon') }, '🏰 Build a dungeon'),
            h('button', { onclick: () => this.app.navigate('community') }, '📥 Import from a friend')))),
    ];
  }

  #namePrompt() {
    const { profile } = this.services;
    if (profile.data.playerName) return null;
    const input = h('input', { type: 'text', maxlength: 32, placeholder: 'Your name', 'aria-label': 'Your name' });
    return h('form', {
      class: 'name-prompt',
      onsubmit: (event) => {
        event.preventDefault();
        const name = input.value.trim();
        if (!name) return;
        profile.setPlayerName(name);
        this.services.saveProfile();
        this.refresh();
      },
    }, h('label', {}, 'What should friends see as the creator of your content?'), h('div', { class: 'row-left' }, input, h('button', { type: 'submit' }, 'Save')));
  }

  #records() {
    const { profile } = this.services;
    return h('div', { class: 'stat-row' },
      h('div', { class: 'stat' }, h('b', {}, profile.stat('runsWon')), h('small', {}, 'dungeons cleared')),
      h('div', { class: 'stat' }, h('b', {}, profile.stat('enemiesDefeated')), h('small', {}, 'enemies defeated')),
      h('div', { class: 'stat' }, h('b', {}, profile.currentStreak()), h('small', {}, 'day streak 🔥')));
  }

  #dailyPanel() {
    const { library, profile, progression } = this.services;
    const daily = this.app.session.dailyChallenge();
    const dungeon = library.get(daily.dungeonId);
    const modifier = daily.createModifier();
    const won = profile.hasWonDaily(daily.key);
    const streak = profile.currentStreak();

    return h('div', { class: ['panel', 'daily-panel', won && 'done'] },
      h('div', { class: 'daily-head' }, h('h2', {}, '📅 Daily Challenge'), h('span', { class: 'muted' }, daily.key)),
      h('p', {}, h('b', {}, `${dungeon.icon} ${dungeon.name}`), ' with a fixed team — the same for every player today.'),
      h('div', { class: 'modifier' }, h('b', {}, modifier.label), ': ', modifier.description),
      h('div', { class: 'daily-team' }, daily.heroIds.map((id) => {
        const hero = library.get(id);
        const locked = !progression.isHeroAvailable(hero);
        return h('div', { class: 'mini-hero', title: locked ? 'Not unlocked yet — try them out today!' : hero.name },
          h('span', { class: 'mini-portrait' }, hero.portrait), h('small', {}, hero.name), locked ? h('small', { class: 'pill pill-info' }, 'Trial') : null);
      })),
      h('p', { class: 'muted' }, won
        ? `Completed today ✓ — come back tomorrow to keep your ${streak}-day streak.`
        : streak ? `Win today to extend your ${streak}-day streak! (+75 renown)` : 'Win to start a streak. (+75 renown)'),
      h('button', {
        class: won ? '' : 'primary',
        onclick: () => {
          this.app.session.startDaily();
          this.app.navigate('combat');
        },
      }, won ? 'Play again (bonus already claimed)' : 'Take the challenge'));
  }
}
