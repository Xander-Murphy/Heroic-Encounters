/**
 * Minimal publish/subscribe hub (Observer).
 *
 * Gameplay code announces what happened ("run.finished", "content.shared")
 * without knowing who cares; progression, achievements, analytics and the UI
 * subscribe independently. Adding a new listener never touches the code that
 * emits the event.
 */
export class EventBus {
  #handlers = new Map();

  on(event, handler) {
    if (!this.#handlers.has(event)) this.#handlers.set(event, new Set());
    this.#handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this.#handlers.get(event)?.delete(handler);
  }

  /** Handlers for "*" receive every event as (payload, eventName). */
  emit(event, payload = {}) {
    for (const handler of [...(this.#handlers.get(event) ?? []), ...(this.#handlers.get('*') ?? [])]) {
      try {
        handler(payload, event);
      } catch (error) {
        console.error(`Error in "${event}" handler`, error);
      }
    }
  }
}
