/**
 * Base class for objects that are defined once and copied per use (Prototype pattern).
 *
 * The content library builds *prototypes*: they describe a character, ability
 * or status effect but are never mutated. Anything that takes damage, spends a
 * cooldown or gains an effect works on a clone, so two enemies built from the
 * same prototype never share health or cooldowns.
 *
 * Unlike structuredClone, this keeps each object's class, so a cloned Hero is
 * still a Hero with all of its methods.
 */
export class Prototype {
  clone() {
    return deepClone(this, new WeakMap());
  }

  /** Hook for subclasses that need fresh identity after cloning. */
  onClone() {}
}

/** Objects marked shared are stateless and safe to reference from every clone. */
export const SHARED = Symbol('shared');

function deepClone(value, seen) {
  if (value === null || typeof value !== 'object') return value;
  if (value[SHARED]) return value;
  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const copy = [];
    seen.set(value, copy);
    value.forEach((item) => copy.push(deepClone(item, seen)));
    return copy;
  }

  const copy = Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);
  for (const key of Object.keys(value)) {
    copy[key] = deepClone(value[key], seen);
  }
  if (copy instanceof Prototype) copy.onClone();
  return copy;
}
