// Resolución de configuración. Sin modo explícito no se arranca: nunca se
// cae en silencio al contenido DEMO.
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const ROOT = path.resolve(import.meta.dirname, '..');

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

function argValue(argv, names) {
  for (const a of argv) {
    for (const n of names) {
      if (a.startsWith(`--${n}=`)) return a.slice(n.length + 3);
    }
  }
  return undefined;
}

/** Rutas del paquete de contenido según el modo. */
export function contentPaths(mode, root = ROOT, env = {}) {
  if (mode === 'demo') {
    const base = path.join(root, 'fixtures', 'demo');
    return {
      mode,
      packageRoot: base,
      publicPath: path.join(base, 'content', 'public.json'),
      keyPath: path.join(base, 'content', 'answer-key.private.json'),
      schemaPath: path.join(base, 'content', 'schema.json'),
      projectionMapPath: path.join(base, 'content', 'projection-map.json'),
      projectionHtmlPath: path.join(base, 'projection', 'index.html'),
      projectionDir: path.join(base, 'projection'),
      rationalesPath: undefined,
    };
  }
  if (mode === 'real') {
    return {
      mode,
      packageRoot: root,
      publicPath: path.join(root, 'content', 'public.json'),
      keyPath: path.resolve(root, env.ANSWER_KEY_PATH || path.join('content', 'answer-key.private.json')),
      schemaPath: path.join(root, 'content', 'schema.json'),
      projectionMapPath: path.join(root, 'content', 'projection-map.json'),
      projectionHtmlPath: path.join(root, 'projection', 'index.html'),
      projectionDir: path.join(root, 'projection'),
      rationalesPath: path.join(root, 'content', 'rationales.private.md'),
    };
  }
  throw new ConfigError(`Modo de contenido desconocido: ${JSON.stringify(mode)}. Use CONTENT_MODE=demo o CONTENT_MODE=real.`);
}

export function resolveConfig({ argv = process.argv.slice(2), env = process.env, root = ROOT } = {}) {
  const warnings = [];
  const mode = argValue(argv, ['modo', 'mode']) ?? env.CONTENT_MODE;
  if (!mode) {
    throw new ConfigError('Falta el modo de contenido. Defina CONTENT_MODE=demo o CONTENT_MODE=real en .env, o use `npm run demo` / `npm run real`. No se elige ninguno por defecto.');
  }
  if (mode !== 'demo' && mode !== 'real') {
    throw new ConfigError(`Modo de contenido inválido: ${JSON.stringify(mode)}. Valores permitidos: demo, real.`);
  }
  const password = env.MODERATOR_PASSWORD;
  if (!password || password.length < 10) {
    throw new ConfigError('Falta MODERATOR_PASSWORD (mínimo 10 caracteres). Ejecute `npm run configurar` para generar un archivo .env con una contraseña aleatoria.');
  }
  const port = env.PORT === undefined || env.PORT === '' ? 3000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new ConfigError(`PORT inválido: ${env.PORT}`);
  const maxFailures = env.LOGIN_MAX_FAILURES ? Number(env.LOGIN_MAX_FAILURES) : 10;
  if (!Number.isInteger(maxFailures) || maxFailures < 1) throw new ConfigError(`LOGIN_MAX_FAILURES inválido: ${env.LOGIN_MAX_FAILURES}`);
  const globalFailures = env.LOGIN_GLOBAL_MAX_FAILURES ? Number(env.LOGIN_GLOBAL_MAX_FAILURES) : 200;
  if (!Number.isInteger(globalFailures) || globalFailures < 1) throw new ConfigError(`LOGIN_GLOBAL_MAX_FAILURES inválido: ${env.LOGIN_GLOBAL_MAX_FAILURES}`);
  if (mode === 'demo' && env.ANSWER_KEY_PATH && path.resolve(root, env.ANSWER_KEY_PATH) !== path.join(root, 'content', 'answer-key.private.json')) {
    warnings.push('ANSWER_KEY_PATH se ignora en modo demo: solo se usa la clave sintética de fixtures/demo/.');
  }
  const dataDir = path.resolve(root, env.DATA_DIR || 'data');
  return {
    root,
    mode,
    content: contentPaths(mode, root, env),
    moderatorPassword: password,
    host: env.HOST || '0.0.0.0',
    port,
    dataDir,
    dbFile: path.join(dataDir, `tribunal-${mode}.sqlite`),
    loginMaxFailures: maxFailures,
    // Tope global de intentos fallidos (todas las IP): limita la fuerza bruta aunque una IP se falsee tras un proxy.
    loginGlobalMaxFailures: globalFailures,
    // Detrás de un proxy HTTPS (p. ej. alojamiento en la nube): usar X-Forwarded-For/Proto.
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    warnings,
  };
}

const fileHash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

/**
 * Comprobaciones extra del modo real (fallan cerrado):
 * - la clave real no puede estar versionada en Git;
 * - el paquete real no puede ser una copia del DEMO.
 */
export function realModeSafetyChecks(config) {
  const errors = [];
  const c = config.content;
  if (config.mode !== 'real') return errors;
  if (existsSync(c.keyPath)) {
    try {
      execFileSync('git', ['ls-files', '--error-unmatch', path.relative(config.root, c.keyPath)], { cwd: config.root, stdio: 'ignore' });
      errors.push(`La clave real (${path.relative(config.root, c.keyPath)}) está versionada en Git. Retírela del repositorio (git rm --cached) antes de usarla; nunca debe publicarse.`);
    } catch {
      // No versionada (o Git no disponible): correcto.
    }
  }
  const demo = contentPaths('demo', config.root);
  for (const [real, dem, label] of [[c.publicPath, demo.publicPath, 'public.json'], [c.keyPath, demo.keyPath, 'la clave privada']]) {
    if (existsSync(real) && existsSync(dem) && fileHash(real) === fileHash(dem)) {
      errors.push(`En modo real, ${label} es idéntico al DEMO. Instale el paquete real de Agente A.`);
    }
  }
  return errors;
}
