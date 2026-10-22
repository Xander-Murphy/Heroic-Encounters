import { isFriendlyTarget, ResultKind, TargetType } from '../../engine/types.js';
import { h, wait } from '../dom.js';
import { SCHOOL_COLORS } from '../themes.js';

/**
 * Combat animations with the Web Animations API (ported from the HTML prototype).
 *
 * Each action plays its wind-up FIRST (lunge, projectile, burst, spin),
 * then the caller applies the real state change and re-renders, then hit
 * effects (shake, flash, floating numbers) play on the fresh cards.
 */
export class Animator {
  constructor({ getSettings }) {
    this.getSettings = getSettings;
  }

  get reduced() {
    const { motion } = this.getSettings();
    if (motion === 'reduced') return true;
    if (motion === 'full') return false;
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  ms(duration) {
    return duration / (this.getSettings().animationSpeed || 1);
  }

  cardFor(character) {
    return character ? document.querySelector(`.tcg-card[data-uid="${character.uid}"]`) : null;
  }

  #center(element) {
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2 + window.scrollX, y: box.top + box.height / 2 + window.scrollY };
  }

  #effect(x, y, css) {
    const element = h('div', { class: 'fx', style: { left: `${x}px`, top: `${y}px`, ...css } });
    document.body.append(element);
    return element;
  }

  #play(element, keyframes, duration, options = {}) {
    return element.animate(keyframes, { duration: this.ms(duration), ...options }).finished.catch(() => {});
  }

  #style(action) {
    if (action.ability.animation) return action.ability.animation;
    if (action.ability.target === TargetType.SELF || isFriendlyTarget(action.ability.target)) return 'glow';
    return action.ability.school === 'physical' ? 'lunge' : 'projectile';
  }

  /** Wind-up animation for an action. Returns a function that eases a lunging card back after re-render. */
  async playWindUp(action) {
    if (this.reduced) return () => {};
    const actorElement = this.cardFor(action.actor);
    if (!actorElement) return () => {};
    const color = SCHOOL_COLORS[action.ability.school] ?? '#ffffff';
    const targets = action.targets.map((target) => this.cardFor(target)).filter(Boolean);
    const style = this.#style(action);
    actorElement.style.zIndex = 20;

    if (style === 'glow' || !targets.length) {
      await this.glow(actorElement, color);
      return () => {};
    }
    if (style === 'lunge') {
      const from = this.#center(actorElement);
      const to = this.#center(targets[0]);
      const offset = { x: (to.x - from.x) * 0.6, y: (to.y - from.y) * 0.6 };
      await this.#play(actorElement, [{ transform: 'none' }, { transform: `translate(${offset.x}px, ${offset.y}px) scale(1.08)` }], 170, { easing: 'ease-in', fill: 'forwards' });
      await this.slash(targets[0], color);
      return () => {
        const fresh = this.cardFor(action.actor);
        if (fresh) this.#play(fresh, [{ transform: `translate(${offset.x}px, ${offset.y}px) scale(1.08)` }, { transform: 'none' }], 260, { easing: 'ease-out' });
      };
    }
    if (style === 'spin') {
      await Promise.all([
        this.#play(actorElement, [{ transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(360deg) scale(1.12)' }], 450, { easing: 'ease-in-out' }),
        wait(this.ms(200)).then(() => Promise.all(targets.map((target) => this.slash(target, color)))),
      ]);
      return () => {};
    }
    if (style === 'burst') {
      await Promise.all([this.glow(actorElement, color), this.ring(actorElement, color)]);
      return () => {};
    }
    await this.glow(actorElement, color, 220);
    await Promise.all(targets.map((target) => this.projectile(actorElement, target, color, style === 'arrow')));
    return () => {};
  }

  glow(element, color, duration = 450) {
    return this.#play(element, [
      { transform: 'scale(1)', boxShadow: `0 0 0 0 ${color}` },
      { transform: 'scale(1.08)', boxShadow: `0 0 26px 8px ${color}` },
      { transform: 'scale(1)', boxShadow: `0 0 0 0 ${color}` },
    ], duration);
  }

  async projectile(fromElement, toElement, color, isArrow) {
    const from = this.#center(fromElement);
    const to = this.#center(toElement);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const shape = isArrow ? { width: '38px', height: '4px', borderRadius: '2px' } : { width: '20px', height: '20px', borderRadius: '50%' };
    const element = this.#effect(from.x, from.y, { ...shape, background: color, boxShadow: `0 0 14px 5px ${color}` });
    await this.#play(element, [
      { transform: `translate(-50%,-50%) rotate(${angle}deg)` },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${angle}deg)` },
    ], 380, { easing: 'ease-in' });
    element.remove();
  }

  async slash(target, color) {
    const center = this.#center(target);
    const element = this.#effect(center.x, center.y, { width: '90px', height: '5px', borderRadius: '3px', background: color, boxShadow: `0 0 12px 3px ${color}` });
    await this.#play(element, [
      { transform: 'translate(-50%,-50%) rotate(-35deg) scaleX(0)', opacity: 1 },
      { transform: 'translate(-50%,-50%) rotate(-35deg) scaleX(1)', opacity: 1, offset: 0.5 },
      { transform: 'translate(-50%,-50%) rotate(-35deg) scaleX(1)', opacity: 0 },
    ], 280);
    element.remove();
  }

  async ring(source, color) {
    const center = this.#center(source);
    const element = this.#effect(center.x, center.y, { width: '60px', height: '60px', borderRadius: '50%', border: `4px solid ${color}`, boxShadow: `0 0 20px ${color}` });
    await this.#play(element, [
      { transform: 'translate(-50%,-50%) scale(0.3)', opacity: 1 },
      { transform: 'translate(-50%,-50%) scale(6)', opacity: 0 },
    ], 550, { easing: 'ease-out' });
    element.remove();
  }

  floatText(element, text, color) {
    const center = this.#center(element);
    const label = this.#effect(center.x, center.y - 20, { font: 'bold 24px Georgia, serif', color, textShadow: '0 2px 4px #000, 0 0 6px #000', whiteSpace: 'nowrap' });
    label.textContent = text;
    this.#play(label, [
      { opacity: 0, transform: 'translate(-50%,-30%) scale(0.6)' },
      { opacity: 1, transform: 'translate(-50%,-90%) scale(1.25)', offset: 0.25 },
      { opacity: 0, transform: 'translate(-50%,-220%) scale(1)' },
    ], this.reduced ? 1400 : 1000, { easing: 'ease-out' }).then(() => label.remove());
  }

  /** Shake / flash / floating numbers for a list of EffectResults (call after re-render). */
  async playResults(results) {
    if (!results.length) return;
    for (const result of results) {
      const element = this.cardFor(result.target);
      if (!element) continue;
      const { text, color } = this.#label(result);
      if (!this.reduced) {
        if (result.kind === ResultKind.DAMAGE) {
          this.#play(element, [
            { transform: 'translateX(0)', filter: 'brightness(2.2)' }, { transform: 'translateX(-9px)' },
            { transform: 'translateX(9px)' }, { transform: 'translateX(-5px)' }, { transform: 'none', filter: 'brightness(1)' },
          ], 350);
        } else if (result.kind === ResultKind.HEAL) {
          this.#play(element, [{ transform: 'scale(1.06)', filter: 'brightness(1.6) saturate(1.5)' }, { transform: 'none', filter: 'none' }], 600);
        } else if (result.kind === ResultKind.PHASE) {
          this.#play(element, [{ transform: 'scale(1)' }, { transform: 'scale(1.15)', filter: 'brightness(1.8)' }, { transform: 'scale(1)' }], 700);
        }
        if (result.defeated) this.#play(element, [{ opacity: 1, transform: 'scale(1.12)' }, { opacity: 0.35, transform: 'scale(1)' }], 600);
      }
      if (text) this.floatText(element, text, color);
    }
    await wait(this.ms(this.reduced ? 250 : 560));
  }

  #label(result) {
    switch (result.kind) {
      case ResultKind.DAMAGE: return { text: `-${result.amount}`, color: SCHOOL_COLORS[result.school] === '#e8e2d0' ? '#ff6a5a' : (SCHOOL_COLORS[result.school] ?? '#ff6a5a') };
      case ResultKind.HEAL: return { text: `+${result.amount}`, color: '#6fe08a' };
      case ResultKind.IMMUNE: return { text: 'Immune', color: '#cfcfcf' };
      case ResultKind.STATUS: return { text: result.description.split(' gains ')[1] ?? '', color: '#9ad8ff' };
      case ResultKind.DISPEL: return { text: result.amount ? 'Cleansed' : '', color: '#ffffff' };
      case ResultKind.PHASE: return { text: 'Phase!', color: '#ff4a3a' };
      case ResultKind.SKIP: return { text: 'Stunned', color: '#ffd84a' };
      default: return { text: '', color: '#fff' };
    }
  }
}
