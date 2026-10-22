import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
});

export const CORS_HEADERS = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
});

export function sendJson(response, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...CORS_HEADERS,
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  response.end(body);
}

/** Read and parse a JSON request body, refusing anything over `limit` bytes. */
export function readJson(request, limit = 300_000) {
  return new Promise((resolve, reject) => {
    if (!(request.headers['content-type'] ?? '').includes('application/json')) {
      reject(new HttpError(415, 'Expected a JSON body.'));
      return;
    }
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, 'Request body is too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new HttpError(400, 'Request body is not valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

/** Serves files from `root`, never outside it. Unknown paths fall back to index.html. */
export class StaticFiles {
  constructor(root) {
    this.root = path.resolve(root);
  }

  async serve(request, response, pathname) {
    let relative;
    try {
      relative = decodeURIComponent(pathname);
    } catch {
      throw new HttpError(400, 'Bad path.');
    }
    if (relative.includes('\0')) throw new HttpError(400, 'Bad path.');

    let filePath = path.resolve(this.root, `.${relative}`);
    if (filePath !== this.root && !filePath.startsWith(this.root + path.sep)) throw new HttpError(403, 'Forbidden.');

    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info) {
      if (path.extname(relative)) throw new HttpError(404, 'Not found.');
      filePath = path.join(this.root, 'index.html');
      info = await stat(filePath);
    }

    const type = MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Length': info.size,
      // The service worker handles offline caching; always revalidate so updates arrive.
      'Cache-Control': 'no-cache',
      ...SECURITY_HEADERS,
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  }
}
