/** The actions queued for one round, ordered fastest first. */
export class ActionQueue {
  #actions = [];

  get actions() {
    return [...this.#actions];
  }

  get size() {
    return this.#actions.length;
  }

  add(action) {
    this.#actions.push(action);
  }

  remove(action) {
    this.#actions = this.#actions.filter((queued) => queued !== action);
  }

  find(predicate) {
    return this.#actions.find(predicate) ?? null;
  }

  /**
   * Highest priority first. `tieBreaker(action)` returns a smaller number for
   * actions that should win ties; the sort is stable so queue order decides the rest.
   */
  sort(tieBreaker = () => 0) {
    this.#actions.sort((a, b) => (b.priority - a.priority) || (tieBreaker(a) - tieBreaker(b)));
  }

  next() {
    return this.#actions.shift() ?? null;
  }

  clear() {
    this.#actions = [];
  }
}
