// Utilidades HTTP mínimas (sin dependencias): cabeceras de seguridad, cookies,
// lectura de cuerpos JSON con límite y respuestas.

export const APP_CSP = "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'";
export const MEDIA_CSP = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function baseHeaders(extra = {}) {
  return {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...extra,
  };
}

export function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, baseHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload), ...extraHeaders }));
  res.end(payload);
}

export function sendError(res, status, code, message, extra = {}) {
  sendJson(res, status, { error: { code, message, ...extra } });
}

export function sendHtml(res, status, html, extraHeaders = {}) {
  res.writeHead(status, baseHeaders({ 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html), ...extraHeaders }));
  res.end(html);
}

export function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k && !(k in out)) out[k] = v;
  }
  return out;
}

export function cookieHeader(name, value, { maxAgeSeconds, secure }) {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (maxAgeSeconds !== undefined) parts.push(`Max-Age=${maxAgeSeconds}`);
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function readJsonBody(req, limitBytes = 16 * 1024) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') {
      reject(new HttpError(415, 'unsupported_media_type', 'Las solicitudes deben enviarse como JSON (Content-Type: application/json).'));
      req.resume();
      return;
    }
    let size = 0;
    const chunks = [];
    let failed = false;
    req.on('data', (c) => {
      if (failed) return;
      size += c.length;
      if (size > limitBytes) {
        failed = true;
        reject(new HttpError(413, 'payload_too_large', 'Solicitud demasiado grande.'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (failed) return;
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new HttpError(400, 'bad_json', 'JSON mal formado.'));
      }
    });
    req.on('error', (e) => {
      if (!failed) reject(e);
    });
  });
}

export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function simplePage(title, bodyHtml) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="/static/app.css"></head><body><main class="contenedor"><h1>${escapeHtml(title)}</h1>${bodyHtml}</main></body></html>`;
}

const MIME = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
};

export function mimeFor(file) {
  const i = file.lastIndexOf('.');
  return MIME[i >= 0 ? file.slice(i).toLowerCase() : ''] ?? 'application/octet-stream';
}
