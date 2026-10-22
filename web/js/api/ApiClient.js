export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Talks to the optional community server.
 *
 * The game never requires it: when the page is opened from static hosting or
 * a plain file server, checkHealth() fails, `available` stays false and the
 * community features explain that they're offline. Everything else
 * (playing, creating, share strings) keeps working.
 */
export class ApiClient {
  constructor({ baseUrl = '', fetchImpl = globalThis.fetch?.bind(globalThis), timeoutMs = 6000 } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.available = false;
    this.connecting = false;
    this.token = null; // set by AccountService while signed in
  }

  /**
   * Free hosting puts the server to sleep when nobody is playing, and the
   * first request waits while it wakes (up to about a minute). So the wait
   * is long; a server that is really unreachable still fails right away.
   */
  async checkHealth({ timeoutMs = 75_000 } = {}) {
    this.connecting = true;
    try {
      const health = await this.#request('GET', '/api/health', undefined, timeoutMs);
      this.available = health?.ok === true;
    } catch {
      this.available = false;
    } finally {
      this.connecting = false;
    }
    return this.available;
  }

  publish({ shareString, kind, title, author, description }) {
    return this.#request('POST', '/api/content', { shareString, kind, title, author, description });
  }

  fetchByCode(code) {
    return this.#request('GET', `/api/content/${encodeURIComponent(code)}`);
  }

  list({ kind = '', sort = 'recent', q = '', limit = 30, offset = 0 } = {}) {
    const params = new URLSearchParams({ sort, limit: String(limit), offset: String(offset) });
    if (kind) params.set('kind', kind);
    if (q) params.set('q', q);
    return this.#request('GET', `/api/content?${params}`);
  }

  like(code, installId) {
    return this.#request('POST', `/api/content/${encodeURIComponent(code)}/like`, { installId });
  }

  recordDownload(code) {
    return this.#request('POST', `/api/content/${encodeURIComponent(code)}/download`, {}).catch(() => null);
  }

  report(code, installId, reason) {
    return this.#request('POST', `/api/content/${encodeURIComponent(code)}/report`, { installId, reason });
  }

  sendMetrics(installId, events) {
    return this.#request('POST', '/api/metrics', { installId, events });
  }

  metricsSummary() {
    return this.#request('GET', '/api/metrics/summary');
  }

  // --- Accounts -------------------------------------------------------------

  register(username, password) {
    return this.#request('POST', '/api/auth/register', { username, password });
  }

  login(username, password) {
    return this.#request('POST', '/api/auth/login', { username, password });
  }

  logout() {
    return this.#request('POST', '/api/auth/logout', {});
  }

  me() {
    return this.#request('GET', '/api/auth/me');
  }

  /** Send the local save; the server merges it with the account's and returns the result. */
  syncSave(save) {
    return this.#request('PUT', '/api/me/save', { save }, 15_000);
  }

  async #request(method, path, body, timeoutMs = this.timeoutMs) {
    if (!this.fetchImpl) throw new Error('Network is unavailable.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = body === undefined ? {} : { 'Content-Type': 'application/json' };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      const response = await this.fetchImpl(this.baseUrl + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new ApiError(response.status, data.error || `Server error (${response.status})`);
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The community server took too long to answer.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
