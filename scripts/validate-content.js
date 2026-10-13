// Puerta de contrato: valida el paquete DEMO o el real y recorre la aplicación
// en busca de fugas. Uso:
//   npm run validar          → fixtures/demo
//   npm run validar:real     → content/ + projection/ + assets/ + clave privada real
// Códigos de salida: 0 = aprobado, 1 = errores, 2 = PENDIENTE (falta el paquete real).
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { resolveConfig, contentPaths, realModeSafetyChecks, ROOT } from '../src/config.js';
import { loadContent, ContentError } from '../src/content/load.js';
import { createApp } from '../src/http/app.js';
import { crawlForLeaks } from './lib/leak-crawl.js';
import { randomSecret } from './lib/temp-secret.js';

const modeArg = process.argv.find((a) => a.startsWith('--modo='));
const mode = modeArg ? modeArg.slice('--modo='.length) : 'demo';
if (mode !== 'demo' && mode !== 'real') {
  console.error('Uso: node scripts/validate-content.js --modo=demo|real');
  process.exit(1);
}
if (mode === 'real' && existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

const ok = (m) => console.log(`  ✔ ${m}`);
const bad = (m) => console.log(`  ✖ ${m}`);
const pend = (m) => console.log(`  ⏳ PENDIENTE: ${m}`);
let failed = false;

console.log(`\nValidación del paquete de contenido — modo ${mode.toUpperCase()}${mode === 'demo' ? ' (DEMO — DATOS FICTICIOS DE PRUEBA)' : ''}\n`);

// 0) Higiene de Git: los archivos privados deben estar ignorados y sin versionar.
try {
  const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n');
  const forbidden = tracked.filter((f) => f === '.env' || f.startsWith('data/') || /^content\/.*\.private\./.test(f) || f.endsWith('.sqlite'));
  if (forbidden.length) {
    bad(`Archivos privados versionados en Git: ${forbidden.join(', ')}`);
    failed = true;
  } else ok('Ningún archivo privado (clave real, justificaciones, .env, data/) está versionado en Git');
  const mustIgnore = ['content/answer-key.private.json', 'content/rationales.private.md', '.env', 'data/tribunal-real.sqlite'];
  const notIgnored = mustIgnore.filter((f) => {
    try {
      execFileSync('git', ['check-ignore', '-q', f], { cwd: ROOT });
      return false;
    } catch {
      return true;
    }
  });
  if (notIgnored.length) {
    bad(`.gitignore no cubre: ${notIgnored.join(', ')}`);
    failed = true;
  } else ok('.gitignore cubre la clave real, las justificaciones, .env y la base de datos');
} catch {
  console.log('  ⚠ Git no disponible: no se pudo comprobar la higiene del repositorio');
}

// 1) Presencia de archivos (en modo real, su ausencia es PENDIENTE, no aprobado).
const paths = contentPaths(mode, ROOT, process.env);
const required = [
  ['public.json', paths.publicPath],
  ['schema.json', paths.schemaPath],
  ['projection-map.json', paths.projectionMapPath],
  ['proyección (index.html)', paths.projectionHtmlPath],
  ['clave privada', paths.keyPath],
];
const missing = required.filter(([, p]) => !existsSync(p));
if (missing.length) {
  if (mode === 'real') {
    for (const [label, p] of missing) pend(`falta ${label}: ${path.relative(ROOT, p)} (paquete de Agente A / entrega segura de la clave)`);
    console.log('\nResultado: PENDIENTE — la integración real no se ha validado. No cuenta como aprobada.\n');
    process.exit(2);
  }
  for (const [label, p] of missing) bad(`falta ${label}: ${path.relative(ROOT, p)}`);
  process.exit(1);
}
ok('Todos los archivos del paquete existen');

// 2) Contrato (esquema + comprobaciones en código).
let content;
try {
  content = loadContent(paths);
  ok('JSON válido y conforme al esquema');
  ok('Contrato v1.0: versión e IDs exactos, listas no vacías, IDs globalmente únicos, referencias cruzadas, «revealed_in», sin referencias al futuro, combinaciones sin duplicar, recursos existentes');
  ok('Mapa de proyección: todas las fases mapeadas a diapositivas existentes');
  ok('Sin datos privados en public.json, projection-map.json ni en el HTML de la proyección');
  for (const w of content.warnings) console.log(`  ⚠ ${w}`);
} catch (e) {
  if (!(e instanceof ContentError)) throw e;
  bad('El paquete no cumple el contrato:');
  for (const err of e.errors) console.log(`      - ${err}`);
  console.log('\nResultado: ERRORES — corríjalos antes de usar este contenido.\n');
  process.exit(1);
}

// 3) Seguridad específica del modo real.
const dataDir = mkdtempSync(path.join(os.tmpdir(), 'tribunal-validar-'));
const password = randomSecret();
const config = resolveConfig({ argv: [`--modo=${mode}`], env: { ...process.env, MODERATOR_PASSWORD: password, DATA_DIR: dataDir, LOGIN_MAX_FAILURES: '100' } });
if (mode === 'real') {
  const safety = realModeSafetyChecks(config);
  if (safety.length) {
    for (const s of safety) bad(s);
    failed = true;
  } else ok('Clave real no versionada y distinta de la DEMO; public.json distinto del DEMO');
}

// 4) Recorrido HTTP completo en busca de fugas.
const app = createApp(config);
await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
try {
  const { errors, stats } = await crawlForLeaks({ app, password, webDir: path.join(ROOT, 'src', 'web') });
  if (errors.length) {
    bad(`Fugas o accesos indebidos detectados (${errors.length}):`);
    for (const e of errors.slice(0, 30)) console.log(`      - ${e}`);
    failed = true;
  } else {
    ok(`Rutas públicas y de equipo sin fugas: ${stats.stages} etapas recorridas, ${stats.requests} peticiones (clave, evidencia futura, respuestas/objeciones sin bloquear, archivos privados, recorridos «..»)`);
    ok('La proyección se sirve byte a byte sin cambios y solo con sesión de moderación');
  }
} finally {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log(failed ? '\nResultado: ERRORES\n' : `\nResultado: APROBADO (modo ${mode})${mode === 'demo' ? ' — esto NO valida el contenido real de Agente A' : ''}\n`);
process.exit(failed ? 1 : 0);
