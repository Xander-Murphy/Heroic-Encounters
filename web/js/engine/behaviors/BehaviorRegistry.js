import {
  AggressiveBehavior, CunningBehavior, RandomBehavior, SupportBehavior,
} from './EnemyBehavior.js';

/**
 * Looks up enemy behaviors by the id stored in content definitions.
 * Behaviors are stateless, so the registry hands out one shared instance each.
 */
export class BehaviorRegistry {
  #behaviors = new Map();

  register(BehaviorClass) {
    this.#behaviors.set(BehaviorClass.id, new BehaviorClass());
    return this;
  }

  has(id) {
    return this.#behaviors.has(id);
  }

  get(id) {
    return this.#behaviors.get(id) ?? this.#behaviors.get(RandomBehavior.id);
  }

  /** [{ id, label, description }] for editors. */
  options() {
    return [...this.#behaviors.values()].map((behavior) => ({
      id: behavior.constructor.id,
      label: behavior.constructor.label,
      description: behavior.constructor.description,
    }));
  }
}

export const defaultBehaviorRegistry = new BehaviorRegistry()
  .register(RandomBehavior)
  .register(AggressiveBehavior)
  .register(SupportBehavior)
  .register(CunningBehavior);
