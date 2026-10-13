// Pruebas de extremo a extremo con un navegador real (Chromium).
// Arranca un servidor DEMO con una base de datos temporal y nueva en cada ejecución.
import { defineConfig } from '@playwright/test';
import { randomSecret } from './scripts/lib/temp-secret.js';

const PORT = Number(process.env.E2E_PORT || 3990);
// Aleatoria por ejecución; los procesos de prueba la heredan del proceso principal.
process.env.E2E_MODERATOR_SECRET ||= randomSecret();

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results/e2e',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node --disable-warning=ExperimentalWarning tests/e2e/servidor.js`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    env: { E2E_PORT: String(PORT), E2E_MODERATOR_SECRET: process.env.E2E_MODERATOR_SECRET },
    timeout: 30_000,
  },
});
