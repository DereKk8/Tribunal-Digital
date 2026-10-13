// Servidor DEMO para las pruebas E2E: base de datos temporal y contraseña de prueba.
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveConfig } from '../../src/config.js';
import { createApp } from '../../src/http/app.js';

const dataDir = mkdtempSync(path.join(os.tmpdir(), 'tribunal-e2e-'));
const config = resolveConfig({
  argv: ['--modo=demo'],
  env: { MODERATOR_PASSWORD: process.env.E2E_MODERATOR_SECRET, DATA_DIR: dataDir, LOGIN_MAX_FAILURES: '200' },
});
const app = createApp(config);
app.server.listen(Number(process.env.E2E_PORT || 3990), '127.0.0.1', () => {
  console.log(`Servidor E2E (DEMO) en ${app.server.address().port}; datos en ${dataDir}`);
});
