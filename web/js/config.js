/**
 * Where the shared community server lives.
 *
 * Empty means "the server this page came from", which is what `npm start`
 * gives you. Once a public server is hosted, put its address here (e.g.
 * 'https://heroic-encounters.example') so every copy of the game, including
 * downloaded ones, shares one community database and one set of accounts.
 * Players can still override it in Settings → Community server.
 */
export const DEFAULT_SERVER_URL = 'https://heroic-encounters.onrender.com';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * True when this page was served by a local `npm run dev` server, which keeps
 * development and testing off the shared database. A plain `npm start` (or
 * any other host) answers false, so downloaded copies still join everyone else.
 */
export async function isLocalDevServer({ location = globalThis.location, fetchImpl = globalThis.fetch?.bind(globalThis), timeoutMs = 1500 } = {}) {
  if (!location || !fetchImpl || !LOCAL_HOSTS.includes(location.hostname)) return false;
  try {
    const response = await fetchImpl(new URL('api/health', location.href).href, { signal: AbortSignal.timeout(timeoutMs) });
    return response.ok && (await response.json()).dev === true;
  } catch {
    return false;
  }
}
