// Punto de entrada: `npm run demo`, `npm run real` o `npm start` (usa CONTENT_MODE de .env).
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveConfig, ConfigError, ROOT } from './config.js';
import { createApp } from './http/app.js';
import { ContentError } from './content/load.js';
import { StartupError } from './game/service.js';
import { DEMO_NOTICE } from './constants.js';

function fail(title, detail) {
  console.error(`\n✖ ${title}\n${detail}\n`);
  process.exit(1);
}

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  fail('Versión de Node.js no compatible', `Se necesita Node.js 22.13 o superior (tiene ${process.versions.node}). Descárguelo de https://nodejs.org`);
}

const envFile = path.join(ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

let config;
try {
  config = resolveConfig();
} catch (e) {
  if (e instanceof ConfigError) fail('Configuración incompleta', e.message);
  throw e;
}
for (const w of config.warnings) console.warn(`⚠ ${w}`);

let app;
try {
  app = createApp(config);
} catch (e) {
  if (e instanceof ContentError) {
    fail(`No se puede arrancar en modo ${config.mode}: el paquete de contenido no es válido (fallo cerrado, sin usar datos DEMO de reemplazo).`,
      `- ${e.errors.join('\n- ')}`);
  }
  if (e instanceof StartupError) fail('No se puede arrancar (fallo cerrado)', e.message);
  throw e;
}

for (const w of app.content.warnings) console.warn(`⚠ Aviso de contenido: ${w}`);

app.server.listen(config.port, config.host, () => {
  const port = app.server.address().port;
  const addrs = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  const hosts = addrs.length ? addrs : ['localhost'];
  console.log('\n Tribunal Digital — servidor listo');
  console.log(` Modo de contenido: ${config.mode === 'demo' ? `DEMO (${DEMO_NOTICE})` : 'REAL (paquete de Agente A)'}`);
  const rel = path.relative(ROOT, config.dbFile);
  console.log(` Base de datos: ${rel.startsWith('..') ? config.dbFile : rel}`);
  console.log('\n Teléfonos de los equipos (misma red Wi-Fi):');
  for (const h of hosts) console.log(`   http://${h}:${port}/`);
  console.log('\n Panel de moderación (en este portátil):');
  console.log(`   http://localhost:${port}/moderador`);
  console.log('\n Proyección (se abre desde el panel, requiere sesión de moderación):');
  console.log(`   http://localhost:${port}/projection/`);
  console.log('\n Los códigos de equipo se muestran en el panel de moderación. Ctrl+C para detener.\n');
});

const shutdown = () => {
  console.log('\nDeteniendo el servidor…');
  app.close().then(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
