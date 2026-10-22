import { ContentSource } from '../../content/ContentLibrary.js';
import { h, plural } from '../dom.js';
import { Screen, screenHeader } from '../Screen.js';
import { characterCard } from '../components/Card.js';
import { emptyState, tabs } from '../components/widgets.js';
import { ROLE_ICONS } from '../themes.js';

const TEAM_SIZE = 3;

/** Pick three heroes and a dungeon, then start the run. */
export class PlayScreen extends Screen {
  static nav = 'play';
  static title = 'Play';

  enter() {
    const available = new Set(this.services.progression.availableHeroes().map((hero) => hero.id));
    this.team = this.app.session.lastTeam.filter((id) => available.has(id));
    this.dungeonId = this.app.session.lastDungeonId;
    this.filter = 'all';
    this.listen('content.imported', () => this.refresh());
  }

  render() {
    return [
      screenHeader('Choose your party', 'Pick three heroes — mix damage, defense and healing — then choose a dungeon.'),
      this.#teamStrip(),
      this.#roster(),
      h('h2', {}, 'Choose a dungeon'),
      this.#dungeons(),
      h('div', { class: 'sticky-start' }, this.#startButton()),
    ];
  }

  #toggle(id) {
    const index = this.team.indexOf(id);
    if (index >= 0) this.team.splice(index, 1);
    else if (this.team.length < TEAM_SIZE) this.team.push(id);
    else this.app.toaster.show('Your party is full. Click a chosen hero to swap them out.', { icon: 'ℹ️' });
    this.refresh();
  }

  #teamStrip() {
    const { library } = this.services;
    const slots = Array.from({ length: TEAM_SIZE }, (_, index) => {
      const hero = library.get(this.team[index]);
      return hero
        ? h('button', { class: 'team-slot filled', onclick: () => this.#toggle(hero.id), title: 'Remove from party' },
          h('span', { class: 'mini-portrait' }, hero.portrait), h('span', {}, hero.name), h('small', { class: 'muted' }, `${ROLE_ICONS[hero.role] ?? ''} ${hero.role}`))
        : h('div', { class: 'team-slot' }, h('span', { class: 'mini-portrait muted' }, '＋'), h('small', { class: 'muted' }, 'Empty slot'));
    });
    return h('div', { class: 'team-strip', 'aria-label': `Party ${this.team.length} of ${TEAM_SIZE}` }, slots);
  }

  #roster() {
    const { library, progression, profile } = this.services;
    const all = library.heroes();
    const sources = {
      all: () => true,
      core: (hero) => library.meta(hero.id).source === ContentSource.CORE,
      created: (hero) => library.meta(hero.id).source === ContentSource.CREATED,
      imported: (hero) => library.meta(hero.id).source === ContentSource.IMPORTED,
    };
    const shown = all.filter(sources[this.filter]);
    const count = (key) => all.filter(sources[key]).length;

    const cards = shown.map((definition) => {
      const hero = library.instantiate(definition.id);
      const available = progression.isHeroAvailable(definition);
      const position = this.team.indexOf(definition.id);
      const mastery = profile.masteryFor(definition.id);
      const meta = library.meta(definition.id);
      return h('div', { class: 'roster-cell' },
        characterCard(hero, {
          classes: [position >= 0 && 'in-team'].filter(Boolean).join(' '),
          onClick: available ? () => this.#toggle(definition.id) : null,
          locked: !available,
          lockText: available ? null : progression.unlocks.requirement(definition),
          badge: position >= 0 ? { text: position + 1, title: 'Party slot' } : mastery ? { text: mastery.icon, title: `${mastery.label} mastery` } : null,
        }),
        meta.source !== ContentSource.CORE
          ? h('small', { class: 'card-caption' }, meta.source === ContentSource.IMPORTED ? `by ${definition.author || meta.origin?.author || 'a friend'}` : 'Your creation')
          : null);
    });

    return h('div', {},
      tabs([
        { id: 'all', label: 'All', count: count('all') },
        { id: 'core', label: 'Built-in', count: count('core') },
        { id: 'created', label: 'Mine', count: count('created') },
        { id: 'imported', label: 'Imported', count: count('imported') },
      ], this.filter, (id) => { this.filter = id; this.refresh(); }),
      cards.length
        ? h('div', { class: 'card-grid' }, cards)
        : emptyState('🦸', 'No heroes here yet', this.filter === 'imported' ? 'Import heroes from friends on the Community page.' : 'Design your own in the Workshop.',
          h('button', { onclick: () => this.app.navigate(this.filter === 'imported' ? 'community' : 'edit-hero') }, this.filter === 'imported' ? 'Go to Community' : 'Create a hero')));
  }

  #dungeons() {
    const { library, profile } = this.services;
    return h('div', { class: 'dungeon-grid' }, library.dungeons().map((dungeon) => {
      const playable = library.isPlayable(dungeon);
      const meta = library.meta(dungeon.id);
      const record = profile.dungeonRecord(dungeon.id);
      const boss = library.get(dungeon.boss);
      return h('button', {
        class: ['dungeon-card', `theme-${dungeon.theme}`, this.dungeonId === dungeon.id && 'selected'],
        disabled: !playable,
        'aria-pressed': String(this.dungeonId === dungeon.id),
        onclick: () => { this.dungeonId = dungeon.id; this.refresh(); },
      },
      h('div', { class: 'dungeon-icon' }, dungeon.icon),
      h('div', { class: 'dungeon-info' },
        h('b', {}, dungeon.name),
        h('div', { class: 'stars', title: `Difficulty ${dungeon.difficulty}` }, '★'.repeat(dungeon.difficulty), h('span', { class: 'muted' }, '★'.repeat(5 - dungeon.difficulty))),
        h('p', {}, dungeon.description),
        h('small', { class: 'muted' }, `${plural(dungeon.waves.length, 'wave')} · Boss: ${boss?.name ?? 'missing!'}`),
        meta.source !== ContentSource.CORE ? h('small', { class: 'muted' }, meta.source === ContentSource.IMPORTED ? ` · by ${dungeon.author || meta.origin?.author || 'a friend'}` : ' · your dungeon') : null,
        record.runs ? h('div', { class: 'record' }, `Cleared ${record.wins}/${record.runs}`, record.bestRounds ? ` · best ${record.bestRounds} rounds` : '') : null,
        playable ? null : h('div', { class: 'warning' }, `Missing ${plural(library.missingDependencies(dungeon).length, 'enemy', 'enemies')} — re-import it from its creator.`)));
    }));
  }

  #startButton() {
    const dungeon = this.services.library.get(this.dungeonId);
    const ready = this.team.length === TEAM_SIZE && dungeon && this.services.library.isPlayable(dungeon);
    const hint = this.team.length < TEAM_SIZE ? `Choose ${TEAM_SIZE - this.team.length} more ${TEAM_SIZE - this.team.length === 1 ? 'hero' : 'heroes'}` : !dungeon ? 'Choose a dungeon' : `Enter ${dungeon.name}`;
    return h('button', {
      class: 'primary big',
      disabled: !ready,
      onclick: () => {
        this.app.session.startRun({ dungeonId: this.dungeonId, heroIds: this.team });
        this.app.navigate('combat');
      },
    }, ready ? `⚔️ ${hint}` : hint);
  }
}
