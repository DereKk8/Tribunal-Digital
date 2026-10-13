// Servidor HTTP: rutas, autenticación por rol y entrega de archivos.
// Solo se sirven archivos de listas explícitas; nunca una carpeta raíz que
// contenga content/, .git/ o la base de datos.
import http from 'node:http';
import { readFileSync, readdirSync, existsSync, statSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { loadContent, resolveInside } from '../content/load.js';
import { realModeSafetyChecks } from '../config.js';
import { openDatabase } from '../store/db.js';
import { GameService, GameError, StartupError } from '../game/service.js';
import {
  APP_CSP, MEDIA_CSP, HttpError, baseHeaders, sendJson, sendError, sendHtml, parseCookies,
  cookieHeader, readJsonBody, simplePage, mimeFor, escapeHtml,
} from './util.js';
import { buildCsv } from './csv.js';

const WEB_DIR = path.resolve(import.meta.dirname, '..', 'web');
const TEAM_COOKIE = 'td_team';
const MOD_COOKIE = 'td_mod';
const SESSION_SECONDS = 12 * 3600;

class RateLimiter {
  constructor(max, windowMs, clock) {
    this.max = max;
    this.windowMs = windowMs;
    this.clock = clock;
    this.failures = new Map();
  }
  _recent(key) {
    const now = this.clock().getTime();
    const list = (this.failures.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.failures.set(key, list);
    return list;
  }
  check(key) {
    if (this._recent(key).length >= this.max) {
      throw new HttpError(429, 'too_many_attempts', 'Demasiados intentos fallidos. Espere unos minutos y vuelva a intentarlo.');
    }
  }
  fail(key) { this._recent(key).push(this.clock().getTime()); }
  success(key) { this.failures.delete(key); }
}

function loadWebAssets() {
  const pages = {
    '/': readFileSync(path.join(WEB_DIR, 'equipo.html')),
    '/moderador': readFileSync(path.join(WEB_DIR, 'moderador.html')),
  };
  const staticFiles = new Map();
  for (const name of readdirSync(path.join(WEB_DIR, 'static'))) {
    if (!/^[a-z0-9-]+\.(css|js|svg|woff2)$/.test(name)) continue;
    staticFiles.set(name, { body: readFileSync(path.join(WEB_DIR, 'static', name)), type: mimeFor(name) });
  }
  return { pages, staticFiles };
}

/** Lee un archivo confinado a `dir` (sin escapar por «..» ni por enlaces simbólicos). */
function readConfined(dir, rel) {
  if (!existsSync(dir)) return null;
  const abs = resolveInside(dir, rel);
  if (!abs || !existsSync(abs) || !statSync(abs).isFile()) return null;
  if (!resolveInside(realpathSync(dir), realpathSync(abs))) return null;
  return { body: readFileSync(abs), type: mimeFor(abs) };
}

/**
 * Crea la aplicación. Lanza ContentError / StartupError si el contenido o la
 * configuración no son válidos (fallo cerrado).
 */
export function createApp(config, { clock = () => new Date() } = {}) {
  const content = loadContent(config.content);
  const safety = realModeSafetyChecks(config);
  if (safety.length) throw new StartupError(safety.join('\n'));
  const db = openDatabase(config.dbFile);
  const service = new GameService({ db, content, moderatorPassword: config.moderatorPassword, clock });
  try {
    service.assertContentMatchesActiveGame();
  } catch (e) {
    db.close();
    throw e;
  }
  const web = loadWebAssets();
  const projectionIndex = readFileSync(config.content.projectionHtmlPath);
  const limiter = new RateLimiter(config.loginMaxFailures, 5 * 60 * 1000, clock);
  const globalLimiter = new RateLimiter(config.loginGlobalMaxFailures ?? 200, 5 * 60 * 1000, clock);
  const guardLogin = (kind, ip, fn) => {
    limiter.check(`${kind}:${ip}`);
    globalLimiter.check(kind);
    try {
      const out = fn();
      limiter.success(`${kind}:${ip}`);
      return out;
    } catch (e) {
      if (e instanceof GameError && e.status === 401) {
        limiter.fail(`${kind}:${ip}`);
        globalLimiter.fail(kind);
      }
      throw e;
    }
  };

  const clientIp = (req) => {
    if (config.trustProxy) {
      const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      if (xff) return xff;
    }
    return req.socket.remoteAddress || 'desconocida';
  };
  const isHttps = (req) => config.trustProxy && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

  function checkSameOrigin(req) {
    const site = req.headers['sec-fetch-site'];
    if (site && site !== 'same-origin' && site !== 'none') {
      throw new HttpError(403, 'cross_site', 'Solicitud de otro sitio rechazada.');
    }
    const origin = req.headers.origin;
    if (origin) {
      const host = req.headers.host;
      if (origin !== `http://${host}` && origin !== `https://${host}`) {
        throw new HttpError(403, 'bad_origin', 'Origen no permitido.');
      }
    }
  }

  function sessions(req) {
    const cookies = parseCookies(req.headers.cookie);
    let team;
    let mod;
    return {
      cookies,
      team() {
        if (team === undefined) {
          const s = service.resolveSession(cookies[TEAM_COOKIE]);
          team = s && s.role === 'team' ? s : null;
        }
        return team;
      },
      mod() {
        if (mod === undefined) {
          const s = service.resolveSession(cookies[MOD_COOKIE]);
          mod = s && s.role === 'moderator' ? s : null;
        }
        return mod;
      },
    };
  }

  const requireTeam = (s) => {
    const t = s.team();
    if (!t) throw new HttpError(401, 'team_auth_required', 'Ingrese el código de su equipo.');
    return t;
  };
  const requireMod = (s) => {
    const m = s.mod();
    if (!m) throw new HttpError(401, 'moderator_auth_required', 'Inicie sesión como moderación.');
    return m;
  };

  function denyProjection(res) {
    sendHtml(res, 403, simplePage('Acceso restringido', '<p>La proyección solo puede abrirla la moderación desde su panel. Los códigos de equipo no dan acceso a la presentación.</p><p><a href="/moderador">Ir al panel de moderación</a></p>'),
      { 'Content-Security-Policy': APP_CSP });
  }

  function sendFile(res, file, extra = {}) {
    res.writeHead(200, baseHeaders({ 'Content-Type': file.type, 'Content-Length': file.body.length, ...extra }));
    res.end(file.body);
  }

  async function route(req, res) {
    const url = new URL(req.url, 'http://localhost');
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      throw new HttpError(400, 'bad_path', 'Ruta inválida.');
    }
    if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some((seg) => seg === '..' || seg === '.')) {
      throw new HttpError(404, 'not_found', 'No encontrado.');
    }
    const method = req.method;
    const s = sessions(req);

    // ------------------------------------------------------------ páginas y estáticos
    if (method === 'GET' && web.pages[pathname]) {
      return sendFile(res, { body: web.pages[pathname], type: 'text/html; charset=utf-8' }, { 'Content-Security-Policy': APP_CSP });
    }
    if (method === 'GET' && pathname.startsWith('/static/')) {
      const f = web.staticFiles.get(pathname.slice('/static/'.length));
      if (!f) throw new HttpError(404, 'not_found', 'No encontrado.');
      return sendFile(res, f, { 'Cache-Control': 'no-cache', 'Content-Security-Policy': APP_CSP });
    }

    // ------------------------------------------------------------ proyección (solo moderación)
    if (method === 'GET' && (pathname === '/projection' || pathname.startsWith('/projection/'))) {
      if (!s.mod()) return denyProjection(res);
      if (pathname === '/projection') {
        res.writeHead(302, baseHeaders({ Location: '/projection/' }));
        return res.end();
      }
      const rel = pathname.slice('/projection/'.length);
      // Se entrega el HTML de la proyección tal cual (sin reescrituras ni CSP propia).
      const projHeaders = { 'X-Frame-Options': 'SAMEORIGIN', 'Cross-Origin-Resource-Policy': 'same-origin' };
      if (rel === '' || rel === 'index.html') return sendFile(res, { body: projectionIndex, type: 'text/html; charset=utf-8' }, projHeaders);
      let f = readConfined(config.content.projectionDir, rel);
      if (!f && rel.startsWith('assets/')) f = readConfined(path.join(config.content.packageRoot, 'assets'), rel.slice('assets/'.length));
      if (!f) throw new HttpError(404, 'not_found', 'No encontrado.');
      return sendFile(res, f, projHeaders);
    }
    if (method === 'GET' && pathname.startsWith('/assets/')) {
      if (!s.mod()) return denyProjection(res);
      const f = readConfined(path.join(config.content.packageRoot, 'assets'), pathname.slice('/assets/'.length));
      if (!f) throw new HttpError(404, 'not_found', 'No encontrado.');
      return sendFile(res, f, { 'Content-Security-Policy': MEDIA_CSP });
    }

    // ------------------------------------------------------------ evidencias para equipos
    if (method === 'GET' && pathname.startsWith('/media/')) {
      const id = pathname.slice('/media/'.length);
      const mod = s.mod();
      const team = mod ? null : s.team();
      if (!mod && !team) throw new HttpError(401, 'auth_required', 'Inicie sesión.');
      const ev = content.evidenceById.get(id);
      const g = service.activeGame();
      // A un equipo no se le confirma si existe una evidencia no revelada.
      if (!ev || (team && (!g || !service.isEvidenceReleased(id, g.stage_index)))) throw new HttpError(404, 'not_found', 'No encontrado.');
      const f = readConfined(config.content.packageRoot, ev.asset_path);
      if (!f) throw new HttpError(404, 'not_found', 'No encontrado.');
      return sendFile(res, f, { 'Content-Security-Policy': MEDIA_CSP });
    }

    // ------------------------------------------------------------ API pública
    if (pathname === '/api/health' && method === 'GET') {
      return sendJson(res, 200, { ok: true, content_mode: content.mode, demo: content.mode === 'demo' });
    }
    if (pathname === '/api/public-state' && method === 'GET') {
      return sendJson(res, 200, service.getPublicState());
    }

    if (!pathname.startsWith('/api/')) {
      return sendHtml(res, 404, simplePage('Página no encontrada', '<p><a href="/">Volver al inicio</a></p>'), { 'Content-Security-Policy': APP_CSP });
    }

    // A partir de aquí: API con sesión.
    if (method === 'POST') checkSameOrigin(req);
    const post = (p) => method === 'POST' && pathname === p;
    const get = (p) => method === 'GET' && pathname === p;
    const secure = isHttps(req);

    // ------------------------------------------------------------ equipos
    if (post('/api/team/login')) {
      const body = await readJsonBody(req);
      const { token, team } = guardLogin('team', clientIp(req), () => service.teamLogin(body.code));
      return sendJson(res, 200, { team }, { 'Set-Cookie': cookieHeader(TEAM_COOKIE, token, { maxAgeSeconds: SESSION_SECONDS, secure }) });
    }
    if (post('/api/team/logout')) {
      service.logout(s.cookies[TEAM_COOKIE]);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(TEAM_COOKIE, '', { maxAgeSeconds: 0, secure }) });
    }
    if (get('/api/team/state')) return sendJson(res, 200, service.getTeamState(requireTeam(s)));
    if (post('/api/team/response')) {
      const team = requireTeam(s);
      const body = await readJsonBody(req);
      const r = service.submitResponse(team, body);
      return sendJson(res, r.status === 'recorded' ? 201 : 200, r);
    }
    if (post('/api/team/objection')) {
      const team = requireTeam(s);
      const body = await readJsonBody(req);
      const r = service.submitObjection(team, body);
      return sendJson(res, r.status === 'recorded' ? 201 : 200, r);
    }

    // ------------------------------------------------------------ moderación
    if (post('/api/moderator/login')) {
      const body = await readJsonBody(req);
      const { token } = guardLogin('mod', clientIp(req), () => service.moderatorLogin(body.password));
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(MOD_COOKIE, token, { maxAgeSeconds: SESSION_SECONDS, secure }) });
    }
    if (post('/api/moderator/logout')) {
      service.logout(s.cookies[MOD_COOKIE]);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(MOD_COOKIE, '', { maxAgeSeconds: 0, secure }) });
    }
    if (get('/api/moderator/state')) {
      requireMod(s);
      return sendJson(res, 200, service.getModeratorState());
    }
    if (post('/api/moderator/game')) {
      const m = requireMod(s);
      await readJsonBody(req);
      return sendJson(res, 200, service.createGame(m.actor));
    }
    if (post('/api/moderator/reset')) {
      const m = requireMod(s);
      const body = await readJsonBody(req);
      return sendJson(res, 200, service.resetGame(m.actor, body.confirm));
    }
    if (post('/api/moderator/advance')) {
      const m = requireMod(s);
      const body = await readJsonBody(req);
      return sendJson(res, 200, service.advance(body.expected_stage_index, m.actor));
    }
    if (post('/api/moderator/score')) {
      const m = requireMod(s);
      const body = await readJsonBody(req);
      return sendJson(res, 200, service.scoreRound(body.round_id, m.actor));
    }
    if (get('/api/moderator/export.json') || get('/api/moderator/export.csv')) {
      requireMod(s);
      const data = service.exportAudit();
      const stamp = data.exported_at.replace(/[:.]/g, '-');
      const base = `tribunal-auditoria-${data.content_mode}-${data.game.id.slice(0, 8)}-${stamp}`;
      if (pathname.endsWith('.json')) {
        return sendJson(res, 200, data, { 'Content-Disposition': `attachment; filename="${base}.json"` });
      }
      const csv = buildCsv(data);
      res.writeHead(200, baseHeaders({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${base}.csv"` }));
      return res.end(csv);
    }

    throw new HttpError(404, 'not_found', 'Ruta de API desconocida.');
  }

  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return sendError(res, 405, 'method_not_allowed', 'Método no permitido.');
    }
    route(req, res).catch((e) => {
      if (res.headersSent) return res.destroy();
      if (e instanceof GameError) return sendError(res, e.status, e.code, e.message, e.extra);
      if (e instanceof HttpError) return sendError(res, e.status, e.code, e.message);
      // Barreras de la base de datos (no deberían alcanzarse: el servicio valida antes).
      const msg = String(e?.message ?? '');
      if (msg.includes('token_limit')) return sendError(res, 409, 'no_tokens', 'Su equipo ya no tiene fichas de objeción.');
      if (msg.includes('immutable') || msg.includes('UNIQUE') || msg.includes('PRIMARY KEY') || msg.includes('stage_order')) {
        return sendError(res, 409, 'conflict', 'La operación ya estaba registrada o no está permitida en este momento.');
      }
      // Error inesperado: se registra sin volcar datos privados al cliente.
      console.error(`[error] ${req.method} ${escapeHtml(req.url.slice(0, 120))}: ${e?.code ?? ''} ${e?.message ?? e}`);
      return sendError(res, 500, 'internal_error', 'Error interno del servidor. Reintente; si persiste, avise a la moderación.');
    });
  });
  server.headersTimeout = 15000;
  server.requestTimeout = 20000;

  return {
    server,
    service,
    content,
    db,
    close() {
      return new Promise((resolve) => {
        server.close(() => {
          try { db.close(); } catch { /* ya cerrada */ }
          resolve();
        });
        server.closeAllConnections?.();
      });
    },
  };
}
