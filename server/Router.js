/**
 * Tiny method + path router: router.get('/api/content/:code', handler).
 * Handlers receive (context) with { request, response, params, query, ip }.
 */
export class Router {
  #routes = [];

  add(method, pattern, handler) {
    const keys = [];
    const regex = new RegExp(`^${pattern.replace(/\/:([a-zA-Z]+)/g, (_, key) => {
      keys.push(key);
      return '/([^/]+)';
    })}/?$`);
    this.#routes.push({ method, regex, keys, handler });
    return this;
  }

  get(pattern, handler) {
    return this.add('GET', pattern, handler);
  }

  post(pattern, handler) {
    return this.add('POST', pattern, handler);
  }

  put(pattern, handler) {
    return this.add('PUT', pattern, handler);
  }

  /** { handler, params } for a request, or null. */
  match(method, pathname) {
    for (const route of this.#routes) {
      if (route.method !== method) continue;
      const found = pathname.match(route.regex);
      if (found) {
        const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(found[index + 1])]));
        return { handler: route.handler, params };
      }
    }
    return null;
  }

  /** True if some route matches the path with any method (for 405 vs 404). */
  matchesPath(pathname) {
    return this.#routes.some((route) => route.regex.test(pathname));
  }
}
