// Utilidades de prueba: arrancar la app real sobre una base de datos temporal,
// copiar y mutar el paquete DEMO, y manejar sesiones HTTP.
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveConfig, contentPaths, ROOT } from '../src/config.js';
import { createApp } from '../src/http/app.js';
import { Client } from '../scripts/lib/http-client.js';
import { randomSecret } from '../scripts/lib/temp-secret.js';

export { Client, ROOT };
export const DEMO_DIR = path.join(ROOT, 'fixtures', 'demo');
// Contraseña de moderación de las pruebas: aleatoria en cada ejecución.
export const PASSWORD = randomSecret();
export { randomSecret };
export const TEAM_IDS = ['azul', 'rojo', 'verde', 'amarillo', 'morado'];

export function tempDir(prefix = 'tribunal-test-') {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Copia el paquete DEMO a una carpeta temporal y devuelve rutas al estilo de contentPaths. */
export function copyDemoPackage() {
  const dir = tempDir('tribunal-pkg-');
  cpSync(DEMO_DIR, dir, { recursive: true });
  return {
    dir,
    paths: {
      mode: 'demo',
      packageRoot: dir,
      publicPath: path.join(dir, 'content', 'public.json'),
      keyPath: path.join(dir, 'content', 'answer-key.private.json'),
      schemaPath: path.join(dir, 'content', 'schema.json'),
      projectionMapPath: path.join(dir, 'content', 'projection-map.json'),
      projectionHtmlPath: path.join(dir, 'projection', 'index.html'),
      projectionDir: path.join(dir, 'projection'),
    },
  };
}

export function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }
export function writeJson(p, v) { writeFileSync(p, JSON.stringify(v, null, 2)); }

/** Modifica public/key/map de un paquete copiado. */
export function mutate(paths, fn) {
  const pub = readJson(paths.publicPath);
  const key = readJson(paths.keyPath);
  const map = readJson(paths.projectionMapPath);
  fn({ pub, key, map });
  writeJson(paths.publicPath, pub);
  writeJson(paths.keyPath, key);
  writeJson(paths.projectionMapPath, map);
}

/** Construye una raíz de repositorio temporal con un paquete «real» (sintético) en content/. */
export function buildRealRoot({ withDemoCopy = true } = {}) {
  const root = tempDir('tribunal-real-');
  mkdirSync(path.join(root, 'content'), { recursive: true });
  for (const f of ['public.json', 'answer-key.private.json', 'schema.json', 'projection-map.json']) {
    cpSync(path.join(DEMO_DIR, 'content', f), path.join(root, 'content', f));
  }
  cpSync(path.join(DEMO_DIR, 'assets'), path.join(root, 'assets'), { recursive: true });
  cpSync(path.join(DEMO_DIR, 'projection'), path.join(root, 'projection'), { recursive: true });
  if (withDemoCopy) cpSync(DEMO_DIR, path.join(root, 'fixtures', 'demo'), { recursive: true });
  return root;
}

/**
 * Arranca la aplicación en un puerto libre.
 * @param {object} [o]
 * @param {object} [o.contentPaths]  rutas de contenido alternativas
 * @param {string} [o.dataDir]       reutilizar una carpeta de datos (pruebas de reinicio)
 */
export async function startApp({ mode = 'demo', contentPathsOverride, dataDir, env = {}, root, clock } = {}) {
  const dd = dataDir ?? tempDir('tribunal-data-');
  const config = resolveConfig({
    argv: [`--modo=${mode}`],
    env: { MODERATOR_PASSWORD: PASSWORD, DATA_DIR: dd, LOGIN_MAX_FAILURES: '1000', ...env },
    root: root ?? ROOT,
  });
  if (contentPathsOverride) config.content = contentPathsOverride;
  const app = createApp(config, clock ? { clock } : {});
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return {
    app,
    base,
    config,
    dataDir: dd,
    async close({ keepData = false } = {}) {
      await app.close();
      if (!keepData && !dataDir) rmSync(dd, { recursive: true, force: true });
    },
  };
}

export async function loginModerator(base) {
  const mod = new Client(base);
  const r = await mod.post('/api/moderator/login', { password: PASSWORD });
  if (r.status !== 200) throw new Error(`login moderación ${r.status}`);
  return mod;
}

/** Crea la partida y conecta los cinco equipos. */
export async function setupGame(base) {
  const mod = await loginModerator(base);
  await mod.post('/api/moderator/game', {});
  const st = (await mod.get('/api/moderator/state')).data;
  const teams = {};
  const codes = {};
  for (const t of st.teams) {
    codes[t.id] = t.code;
    teams[t.id] = new Client(base);
    const r = await teams[t.id].post('/api/team/login', { code: t.code });
    if (r.status !== 200) throw new Error(`login ${t.id} ${r.status}`);
  }
  return { mod, teams, codes };
}

export async function advanceTo(mod, roundId, phase) {
  for (let i = 0; i < 40; i++) {
    const st = (await mod.get('/api/moderator/state')).data;
    if (st.round_id === roundId && st.phase === phase) return st;
    const r = await mod.post('/api/moderator/advance', { expected_stage_index: st.stage_index });
    if (r.status !== 200) throw new Error(`avance ${r.status} ${JSON.stringify(r.data)}`);
  }
  throw new Error(`no se alcanzó ${roundId}/${phase}`);
}

export const contentPathsDemo = () => contentPaths('demo', ROOT);
