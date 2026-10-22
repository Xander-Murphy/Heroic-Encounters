import { ContentController } from './api/ContentController.js';
import { MetricsController } from './api/MetricsController.js';
import { CORS_HEADERS, HttpError, sendJson, StaticFiles } from './http.js';
import { RateLimiter } from './RateLimiter.js';
import { Router } from './Router.js';

/**
 * Builds the request handler: JSON API under /api, the game's static files
 * everywhere else. Dependencies come in as arguments so tests can run the
 * whole app against an in-memory store.
 */
export function createApp({ store, staticDir, storageKind = 'unknown', rateLimiter = new RateLimiter({ capacity: 30, perMinute: 30 }) }) {
  const router = new Router();
  router.get('/api/health', ({ response }) => sendJson(response, 200, { ok: true, storage: storageKind, version: 1 }));
  new ContentController({ store, rateLimiter }).register(router);
  new MetricsController({ store, rateLimiter: new RateLimiter({ capacity: 60, perMinute: 60 }) }).register(router);
  const staticFiles = staticDir ? new StaticFiles(staticDir) : null;

  return async function handle(request, response) {
    const url = new URL(request.url, 'http://localhost');
    const ip = request.headers['x-forwarded-for']?.split(',')[0].trim() || request.socket.remoteAddress || 'unknown';

    try {
      if (url.pathname.startsWith('/api/')) {
        if (request.method === 'OPTIONS') {
          response.writeHead(204, CORS_HEADERS);
          response.end();
          return;
        }
        const match = router.match(request.method, url.pathname);
        if (!match) throw new HttpError(router.matchesPath(url.pathname) ? 405 : 404, 'Not found.');
        await match.handler({ request, response, params: match.params, query: url.searchParams, ip });
        return;
      }

      if (!staticFiles || !['GET', 'HEAD'].includes(request.method)) throw new HttpError(404, 'Not found.');
      await staticFiles.serve(request, response, url.pathname);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error(error);
      if (response.headersSent) {
        response.end();
        return;
      }
      sendJson(response, status, { error: status === 500 ? 'Something went wrong on the server.' : error.message });
    }
  };
}
