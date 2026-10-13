#!/usr/bin/env node
// Prueba del modo en vivo de la proyección contra un servidor SIMULADO (no es la API real del
// Agente B). Levanta un servidor local que sirve projection/index.html en /presentador/ y una
// API /api/public-state configurable, y verifica con Playwright:
//   1) datos en vivo en marcador, fichas y respuestas bloqueadas;
//   2) aviso de conexión perdida conservando los últimos datos;
//   3) modo demostración con 404, con 401 y al abrir el archivo local;
//   4) que el HTML no pide ningún otro recurso del servidor (ni archivos privados).
// Uso: node projection/build/qa-live.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
function loadPlaywright() {
  for (const c of [process.cwd() + '/', ROOT + '/', '/opt/node-tools/node_modules/', '/usr/lib/node_modules/', '/usr/local/lib/node_modules/']) {
    try { return createRequire(c)('playwright'); } catch { /* siguiente */ }
  }
  console.error('✗ No encuentro Playwright. Instálalo con: npm i -D playwright');
  process.exit(2);
}
const { chromium } = loadPlaywright();
const html = readFileSync(path.join(ROOT, 'projection/index.html'));

let mode = 'ok';
const requests = [];
const STATE = {
  round_id: 'R2',
  phase: 'defense',
  scoreboard: { azul: { score: 4, tokens_remaining: 2 }, rojo: { score: 11, tokens_remaining: 1 }, verde: { score: 4, tokens_remaining: 3 }, amarillo: { score: 0, tokens_remaining: 3 }, morado: { score: 2, tokens_remaining: 0 } },
  locked_responses: [
    { team_id: 'rojo', claim_id: 'R2-C4', evidence_ids: ['E05'], action_id: 'R2-A2' },
    { team_id: 'azul', claim_id: 'R2-C1', evidence_ids: ['E06', 'E07'], action_id: 'R2-A1' },
  ],
};
const server = http.createServer((req, res) => {
  requests.push(req.url);
  if (req.url.startsWith('/presentador')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html); }
  if (req.url.startsWith('/api/public-state')) {
    if (mode === 'ok') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(STATE)); }
    if (mode === 'down') { res.writeHead(503); return res.end(); }
    if (mode === 'auth') { res.writeHead(401); return res.end(); }
    res.writeHead(404); return res.end();
  }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const fail = [];
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) fail.push(msg); };
const badge = () => page.textContent('#live-badge');

// 1) En vivo
await page.goto(`${base}/presentador/#r2-resultados`);
await page.waitForFunction(() => document.getElementById('live-badge').textContent.startsWith('En vivo'), null, { timeout: 8000 });
ok((await badge()).startsWith('En vivo'), 'aviso «En vivo» con servidor disponible');
const board = await page.$$eval('#r2-resultados .board-row', (rows) => rows.map((r) => ({ rank: r.querySelector('.rank').textContent, team: r.querySelector('.team').textContent.trim(), score: r.querySelector('.score').firstChild.textContent })));
ok(board.length === 5 && board[0].rank === '1' && board[0].team === 'Equipo Rojo' && board[0].score === '11', `marcador ordenado por puesto (primero: ${JSON.stringify(board[0])})`);
ok(board.filter((b) => b.rank === '2').map((b) => b.team).join(',') === 'Equipo Azul,Equipo Verde' && board[3].rank === '4', 'empate a 4 puntos comparte el puesto 2 y el siguiente es 4.º (rango calculado)');
const tokens = await page.$$eval('#r2-resultados .board-row .tokens', (els) => els.map((e) => e.querySelectorAll('i.on').length));
ok(JSON.stringify(tokens) === JSON.stringify([1, 2, 3, 0, 3]), `fichas dibujadas desde tokens_remaining en orden de puesto (${tokens})`);
await page.evaluate(() => { location.hash = 'r2-defensa'; });
await page.waitForTimeout(300);
const resp = await page.$$eval('#r2-defensa .resp-row', (rows) => rows.map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
ok(resp.length === 5 && resp.some((r) => r.includes('Equipo Rojo') && r.includes('C4') && r.includes('E05')), 'respuestas bloqueadas de R2 visibles en Defensa');
ok(resp.some((r) => r.includes('Equipo Verde') && r.includes('Sin respuesta bloqueada')), 'equipo sin respuesta mostrado como «Sin respuesta bloqueada»');
await page.evaluate(() => { location.hash = 'r1-defensa'; });
await page.waitForTimeout(300);
ok((await page.textContent('#r1-defensa .resp')).includes('aparecerán aquí'), 'en otra ronda no se muestran respuestas ajenas a la ronda');
await page.keyboard.press('g');
await page.waitForTimeout(300);
ok(await page.evaluate(() => location.hash === '#r2-defensa'), 'tecla G salta a la fase indicada por el servidor (R2 · defense)');

// 2) Conexión perdida
mode = 'down';
await page.waitForFunction(() => document.getElementById('live-badge').textContent.startsWith('Sin conexión'), null, { timeout: 8000 });
ok((await badge()).startsWith('Sin conexión'), 'aviso «Sin conexión… últimos datos» al caer el servidor');
await page.evaluate(() => { location.hash = 'r2-resultados'; });
await page.waitForTimeout(300);
ok((await page.$$('#r2-resultados .board-row')).length === 5, 'se conservan los últimos datos del marcador');

// 3) Demostración: 404, 401 y archivo local
mode = '404';
const p2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await p2.goto(`${base}/presentador/#r1-resultados`);
await p2.waitForTimeout(1200);
ok((await p2.textContent('#live-badge')).startsWith('Modo demostración'), 'sin API (404) → modo demostración');
ok((await p2.$$('#r1-resultados .board-row')).length === 5, 'marcador de ejemplo dibujado en demostración');
mode = 'auth';
const p3 = await browser.newPage();
await p3.goto(`${base}/presentador/`);
await p3.waitForTimeout(1200);
ok((await p3.textContent('#live-badge')).includes('ruta de presentador'), '401 → demostración con aviso de ruta de presentador');
const p4 = await browser.newPage();
await p4.goto(pathToFileURL(path.join(ROOT, 'projection/index.html')).href + '#r3-objeciones');
await p4.waitForTimeout(500);
ok((await p4.textContent('#live-badge')).startsWith('Modo demostración'), 'archivo local (file://) → modo demostración');
ok((await p4.$$('#r3-objeciones .token-card')).length === 5, 'fichas de ejemplo en Objeciones');

// 4) Peticiones al servidor
const unexpected = requests.filter((u) => !u.startsWith('/presentador') && !u.startsWith('/api/public-state'));
ok(unexpected.length === 0, `la proyección solo pide /presentador y /api/public-state (${unexpected.join(', ') || 'nada más'})`);

await browser.close();
server.close();
console.log(fail.length ? `\n✗ ${fail.length} fallos` : '\n✓ Modo en vivo y demostración verificados contra el servidor simulado.');
process.exit(fail.length ? 1 : 0);
