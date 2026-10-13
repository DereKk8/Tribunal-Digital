// Simulación determinista de una sesión completa con cinco equipos (contenido DEMO).
// Uso: npm run simular            (imprime la tabla y termina con código 0 si todo coincide)
//      npm run simular -- --exportar=data/simulacion-auditoria.json
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveConfig, ROOT } from '../src/config.js';
import { createApp } from '../src/http/app.js';
import { runSimulation } from './lib/simulation.js';
import { randomSecret } from './lib/temp-secret.js';

const plan = JSON.parse(readFileSync(path.join(ROOT, 'fixtures', 'demo', 'simulation.json'), 'utf8'));
const dataDir = mkdtempSync(path.join(os.tmpdir(), 'tribunal-sim-'));
const password = randomSecret();
const config = resolveConfig({ argv: ['--modo=demo'], env: { MODERATOR_PASSWORD: password, DATA_DIR: dataDir, LOGIN_MAX_FAILURES: '50' } });
const app = createApp(config);
await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
const baseUrl = `http://127.0.0.1:${app.server.address().port}`;

console.log('DEMO — DATOS FICTICIOS DE PRUEBA · Simulación de cinco equipos\n');
const t0 = Date.now();
const result = await runSimulation({ baseUrl, password, plan, log: (m) => console.log(m) });
const ms = Date.now() - t0;
await app.close();
rmSync(dataDir, { recursive: true, force: true });

const pad = (s, n) => String(s).padEnd(n);
const teams = ['azul', 'rojo', 'verde', 'amarillo', 'morado'];
console.log('\nRonda   | ' + teams.map((t) => pad(t, 16)).join('| '));
for (const r of result.rounds ?? []) {
  console.log(pad(r.round_id, 8) + '| ' + teams.map((t) => pad(`+${r.teams[t].round} → ${r.teams[t].total} (fichas ${r.teams[t].tokens})`, 16)).join('| '));
}
if (result.final) {
  console.log('\nClasificación final:');
  for (const s of result.final.scoreboard) {
    console.log(`  ${s.rank}. ${pad(s.team_name, 10)} ${pad(s.score + ' pts', 8)} fichas ${s.objection_tokens_remaining} · objeciones válidas ${s.valid_objections} · argumentos sustentados ${s.supported_arguments}`);
  }
  console.log(`  Ganador(es): ${result.final.winners.join(' y ')}${result.final.winners.length > 1 ? ' (victoria conjunta)' : ''}`);
}
const exportArg = process.argv.find((a) => a.startsWith('--exportar='));
if (exportArg && result.exportJson) {
  const out = path.resolve(ROOT, exportArg.slice('--exportar='.length));
  writeFileSync(out, JSON.stringify(result.exportJson, null, 2));
  console.log(`\nAuditoría exportada en ${out}`);
}
if (result.failures.length) {
  console.error(`\n✖ La simulación NO coincide con lo esperado (${result.failures.length} diferencias):`);
  for (const f of result.failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`\n✔ Simulación completa: todas las puntuaciones, fichas, puestos y comprobaciones coinciden (${ms} ms).`);
