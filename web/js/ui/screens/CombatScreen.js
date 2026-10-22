import { RunState } from '../../engine/DungeonRun.js';
import { resolverFor } from '../../engine/targeting.js';
import { isFriendlyTarget, SCHOOL_LABELS } from '../../engine/types.js';
import { h } from '../dom.js';
import { Screen } from '../Screen.js';
import { abilityDetails, characterCard } from '../components/Card.js';
import { CombatLog } from '../components/CombatLog.js';
import { Modal } from '../components/Modal.js';
import { attachTooltip } from '../components/Tooltip.js';
import { SCHOOL_ICONS } from '../themes.js';

/**
 * The fight. Turns clicks and key presses into Combat calls (the role the
 * original CombatController played) and animates each resolved action.
 * All rules live in the engine; this class only asks and draws.
 */
export class CombatScreen extends Screen {
  static nav = 'play';
  static title = 'Combat';
  static historyEnabled = false;

  enter() {
    this.run = this.app.session.run;
    if (!this.run) return;
    this.selected = null;
    this.pending = null;
    this.animating = false;
    this.interlude = null;
    this.log = new CombatLog({ entries: this.run.log });

    if (this.run.state === RunState.READY) this.#startEncounter();
    else this.#selectNext();

    const onKey = (event) => this.#onKey(event);
    document.addEventListener('keydown', onKey);
    this.disposers.push(() => document.removeEventListener('keydown', onKey));
  }

  get combat() {
    return this.run.combat;
  }

  render() {
    if (!this.run) {
      return h('div', { class: 'panel' }, h('p', {}, 'No dungeon run in progress.'), h('button', { class: 'primary', onclick: () => this.app.navigate('play') }, 'Choose a party'));
    }
    const { run, combat } = this;
    const modifiers = run.modifiers.map((modifier) => h('span', { class: 'pill pill-info', title: modifier.description }, modifier.label));

    return h('div', { class: ['combat-layout', this.animating && 'animating'] },
      h('div', { class: 'combat-main' },
        h('div', { class: 'combat-head' },
          h('div', {},
            h('h1', {}, `${run.dungeon.icon} ${run.dungeon.name}`),
            h('div', { class: 'muted' }, `${run.waveLabel} · Round ${combat.roundNumber}`, run.tags.daily ? ' · Daily Challenge' : '', ' ', modifiers)),
          h('button', { class: 'ghost', onclick: () => this.#retreat(), disabled: this.animating }, '🏳️ Retreat')),
        h('h2', { class: 'row-label' }, 'Enemies'),
        h('div', { class: 'card-row enemy-row' }, combat.enemies.map((enemy) => this.#enemyCard(enemy))),
        h('h2', { class: 'row-label' }, 'Your party'),
        h('div', { class: 'card-row team-row' }, combat.heroes.map((hero) => this.#heroCard(hero))),
        this.#actionPanel(),
        this.#turnOrder(),
        h('div', { class: 'row' }, h('button', {
          class: 'primary big execute',
          disabled: !combat.isReadyToResolve() || this.animating,
          onclick: () => this.#executeRound(),
        }, this.animating ? 'Resolving…' : 'Execute Round ⏎')),
        this.interlude ? this.#interludeOverlay() : null),
      h('aside', { class: 'combat-side' }, h('h2', {}, 'Battle log'), this.log.render()));
  }

  // --- Cards -------------------------------------------------------------------

  #candidates() {
    if (!this.pending || !this.selected) return [];
    return resolverFor(this.pending.target).candidates(this.selected, this.combat.battlefield);
  }

  #enemyCard(enemy) {
    const targetable = this.#candidates().includes(enemy);
    const intent = this.combat.actionFor(enemy);
    return characterCard(enemy, {
      classes: targetable ? 'targetable' : '',
      onClick: targetable ? () => this.#chooseTarget(enemy) : null,
      plannedText: enemy.isAlive() && intent ? `Intends: ${intent.describe()}` : (enemy.isAlive() && !enemy.canAct() ? '💫 Stunned' : ''),
    });
  }

  #heroCard(hero) {
    const queued = this.combat.actionFor(hero);
    const allyTarget = this.#candidates().includes(hero);
    const classes = [hero === this.selected && 'selected', allyTarget && 'ally-target'].filter(Boolean).join(' ');
    return characterCard(hero, {
      classes,
      onClick: allyTarget ? () => this.#chooseTarget(hero) : (hero.canAct() ? () => this.#select(hero) : null),
      plannedText: queued ? `→ ${queued.describe()}` : (hero.isAlive() && !hero.canAct() ? '💫 Stunned' : ''),
    });
  }

  // --- Choosing actions ----------------------------------------------------------

  #actionPanel() {
    const hero = this.selected;
    if (this.combat.isOver()) return null;
    if (!hero) {
      return h('div', { class: 'action-panel' }, h('p', { class: 'hint' },
        this.combat.isReadyToResolve() ? 'Everyone has orders. Press Execute Round (or Enter). Click a hero to change their action.' : 'Click a hero to give them orders.'));
    }

    const buttons = hero.allAbilities().map((ability, index) => {
      const usable = hero.canUse(ability);
      const button = h('button', {
        class: ['ability-btn', this.pending === ability && 'active'],
        disabled: !usable || this.animating,
        onclick: () => this.#chooseAbility(ability),
        'aria-keyshortcuts': String(index + 1),
      },
      h('span', { class: 'key' }, index + 1),
      h('span', {}, `${SCHOOL_ICONS[ability.school]} ${ability.name}`),
      ability.currentCooldown > 0 ? h('small', {}, ` ⏳${ability.currentCooldown}`) : null);
      attachTooltip(button, () => h('div', {},
        h('div', { class: 'tip-title' }, ability.name),
        h('div', { class: 'tip-sub' }, abilityDetails(ability)),
        h('div', {}, ability.description || ability.summary()),
        ability.power ? h('div', { class: 'tip-meta' }, `Power ${ability.power} × (1 + attack/100) · ${SCHOOL_LABELS[ability.school]}`) : null));
      return button;
    });

    const hint = this.pending
      ? (isFriendlyTarget(this.pending.target) ? `Choose an ally for ${this.pending.name}.` : `Choose an enemy for ${this.pending.name}.`)
      : 'Choose an action (keys 1–5). Hover for details.';

    return h('div', { class: 'action-panel' },
      h('h2', {}, `${hero.portrait} ${hero.name}'s turn`),
      h('div', { class: 'row' }, buttons),
      h('p', { class: 'hint' }, hint, this.pending ? h('button', { class: 'link', onclick: () => { this.pending = null; this.refresh(); } }, ' Cancel (Esc)') : null));
  }

  #turnOrder() {
    const queued = [...this.combat.queuedActions()]
      .sort((a, b) => (b.priority - a.priority) || ((a.actor.isHero ? 0 : 1) - (b.actor.isHero ? 0 : 1)));
    if (!queued.length || this.combat.isOver()) return null;
    return h('div', { class: 'turn-order', 'aria-label': 'Planned turn order' },
      h('span', { class: 'muted' }, 'Turn order: '),
      queued.map((action) => h('span', { class: ['turn-chip', action.actor.isHero ? 'hero' : 'enemy'], title: `${action.describe()} (speed ${action.priority})` }, `${action.actor.portrait} ${action.priority}`)));
  }

  #select(hero) {
    if (this.animating || !hero.canAct()) return;
    this.selected = hero;
    this.pending = null;
    this.refresh();
  }

  #selectNext() {
    this.selected = this.combat?.heroesAwaitingOrders()[0] ?? null;
    this.pending = null;
  }

  #chooseAbility(ability) {
    const hero = this.selected;
    if (!hero?.canUse(ability) || this.animating) return;
    const resolver = resolverFor(ability.target);
    if (!resolver.requiresChoice) {
      this.#queue(ability, resolver.resolve(hero, this.combat.battlefield));
      return;
    }
    const candidates = resolver.candidates(hero, this.combat.battlefield);
    if (candidates.length === 1) {
      this.#queue(ability, candidates);
      return;
    }
    this.pending = ability;
    this.refresh();
  }

  #chooseTarget(target) {
    if (this.pending) this.#queue(this.pending, [target]);
  }

  #queue(ability, targets) {
    const action = this.combat.replaceAction(this.selected, ability, targets);
    if (action) this.#selectNext();
    this.pending = null;
    this.refresh();
  }

  #onKey(event) {
    if (event.target.closest('input, textarea, select, dialog') || this.animating || this.interlude) return;
    if (event.key === 'Enter' && this.combat.isReadyToResolve() && !event.target.closest('button, .tcg-card')) {
      event.preventDefault();
      this.#executeRound();
    } else if (event.key === 'Escape' && this.pending) {
      this.pending = null;
      this.refresh();
    } else if (/^[1-9]$/.test(event.key) && this.selected) {
      const ability = this.selected.allAbilities()[Number(event.key) - 1];
      if (ability) this.#chooseAbility(ability);
    }
  }

  // --- Resolving -------------------------------------------------------------------

  async #executeRound() {
    const { combat, run } = this;
    if (this.animating || !combat.isReadyToResolve()) return;
    this.animating = true;
    this.selected = null;
    this.pending = null;
    this.refresh();

    combat.beginRound();
    let step;
    while ((step = combat.executeNextAction()) !== null) {
      const easeBack = await this.app.animator.playWindUp(step.action);
      run.record(step.results);
      this.log.setEntries(run.log);
      this.refresh();
      easeBack();
      await this.app.animator.playResults(step.results);
    }
    const round = combat.roundNumber;
    const upkeep = combat.finishRound();
    run.record(upkeep, round);
    this.log.setEntries(run.log);
    this.refresh();
    await this.app.animator.playResults(upkeep);

    this.animating = false;
    this.#afterRound();
  }

  #afterRound() {
    const { combat, run } = this;
    if (!combat.isOver()) {
      combat.planEnemyActions();
      this.#selectNext();
      this.refresh();
      return;
    }
    if (combat.heroesWon() && !run.isBossWave) {
      this.interlude = { rest: Math.round((run.dungeon.restBetweenWaves ?? 0.25) * 100) };
      this.refresh();
      return;
    }
    run.finishEncounter();
    this.#finish();
  }

  #interludeOverlay() {
    const { run } = this;
    const next = run.waveIndex + 1 === run.dungeon.waves.length ? 'The boss awaits…' : `Wave ${run.waveIndex + 2} is next.`;
    return h('div', { class: 'interlude', role: 'dialog', 'aria-label': 'Wave cleared' },
      h('div', { class: 'interlude-box' },
        h('h2', {}, `${run.waveLabel.split(' of ')[0]} cleared!`),
        h('p', {}, run.modifiers.some((modifier) => modifier.restPercent(1) === 0) ? 'No respite: your heroes press on without healing.' : `Survivors catch their breath and recover ${this.interlude.rest}% health.`),
        h('p', { class: 'muted' }, next),
        h('button', {
          class: 'primary big',
          autofocus: true,
          onclick: () => {
            this.interlude = null;
            run.finishEncounter();
            this.#startEncounter();
            this.log.setEntries(run.log);
            this.refresh();
          },
        }, 'Continue ➜')));
  }

  #startEncounter() {
    const combat = this.run.startEncounter();
    this.services.progression.recordEncounter(combat.enemies);
    combat.planEnemyActions();
    this.#selectNext();
  }

  async #retreat() {
    const sure = await Modal.confirm('Retreat?', 'Your party will leave the dungeon. The run ends as a loss, but you keep the renown earned so far.', { confirmLabel: 'Retreat', danger: true });
    if (!sure) return;
    this.run.abandon();
    this.#finish();
  }

  #finish() {
    const run = this.app.session.endRun();
    const report = this.services.progression.completeRun(run);
    this.app.navigate('summary', { run, report });
  }
}
