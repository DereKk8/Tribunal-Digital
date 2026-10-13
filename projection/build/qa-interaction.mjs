#!/usr/bin/env node
// Prueba de interacción de projection/index.html: navegación (make-slide core-features),
// enlaces por #id, notas en ventana emergente, reloj de fase/turnos y ausencia de errores.
// Uso: node projection/build/qa-interaction.mjs
import { createRequire } from 'node:module';
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
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
const fail = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fail.push(m); };
const url = pathToFileURL(path.join(ROOT, 'projection/index.html')).href;
const active = () => page.evaluate(() => document.querySelector('.slide.active').id);

await page.goto(url);
ok((await active()) === 'portada', 'empieza en la portada');
ok((await page.textContent('#counter')).trim() === '1 / 63', 'contador «1 / 63»');
await page.keyboard.press('ArrowRight');
ok((await active()) === 'aviso', '→ avanza');
await page.keyboard.press('Space');
ok((await active()) === 'mision', 'Espacio avanza');
await page.keyboard.press('ArrowLeft');
ok((await active()) === 'aviso', '← retrocede');
await page.keyboard.press('End');
ok((await active()) === 'cierre-gracias', 'Fin va a la última');
await page.keyboard.press('Home');
ok((await active()) === 'portada', 'Inicio vuelve a la primera');
const w = await page.evaluate(() => document.getElementById('progress').style.width);
ok(w === '0%', `barra de progreso al inicio (${w})`);

await page.goto(url + '#r1-e03');
ok((await active()) === 'r1-e03', 'abre por #id');
await page.keyboard.press('ArrowRight');
ok(await page.evaluate(() => location.hash === '#r1-e04'), 'el #id se actualiza al navegar');

// Notas en ventana emergente
const [popup] = await Promise.all([ctx.waitForEvent('page'), page.keyboard.press('s')]);
await popup.waitForLoadState();
const notes = await popup.textContent('#nt');
const next = await popup.textContent('#nx');
ok(notes.includes('Evidencia E04') && notes.length > 80, 'S abre las notas en ventana aparte con el texto de la diapositiva');
ok(next.includes('Ronda 1 · Deliberación'), `las notas muestran la siguiente diapositiva (${next})`);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(100);
ok((await popup.textContent('#nt')).includes('Deliberación'), 'las notas se actualizan al cambiar de diapositiva');
await page.keyboard.press('s');
await page.waitForTimeout(100);
ok(popup.isClosed(), 'S vuelve a cerrar la ventana de notas');

// Reloj: bloque de revelación compartido entre portada de ronda y evidencias
await page.goto(url + '#r2-revelacion');
ok(await page.isVisible('#timer'), 'el reloj aparece en fases cronometradas');
ok((await page.textContent('#timer .t-time')) === '1:00', 'revelación: 1:00');
await page.keyboard.press('t');
await page.waitForTimeout(2300);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(1200);
const t1 = await page.textContent('#timer .t-time');
ok(t1 === '0:57' || t1 === '0:56', `el reloj sigue corriendo al pasar a la evidencia (${t1})`);
await page.keyboard.press('t');
const t2 = await page.textContent('#timer .t-time');
await page.waitForTimeout(1300);
ok((await page.textContent('#timer .t-time')) === t2, 'T pausa el reloj');
await page.goto(url + '#r2-defensa');
ok((await page.textContent('#timer .t-time')) === '2:30', 'defensa: 2:30');
await page.keyboard.press('n');
await page.waitForTimeout(400);
const turn = await page.textContent('#timer .t-turn');
ok(/Turno 1\/5 · Rojo/.test(turn), `N inicia turnos con el orden rotado de la ronda (${turn})`);
await page.keyboard.press('n');
ok(/Turno 2\/5 · Verde/.test(await page.textContent('#timer .t-turn')), 'N pasa al siguiente portavoz');
await page.keyboard.press('r');
ok((await page.textContent('#timer .t-time')) === '2:30', 'R reinicia');
await page.goto(url + '#final-confrontacion');
ok((await page.textContent('#timer .t-time')) === '3:00', 'confrontación final: 3:00');
await page.goto(url + '#final-alegatos');
ok((await page.textContent('#timer .t-time')) === '2:00', 'alegatos: 2:00 (5 × 24 s)');
await page.goto(url + '#portada');
ok(!(await page.isVisible('#timer')), 'sin reloj en diapositivas sin tiempo');

// Clic: tercio izquierdo retrocede, resto avanza; botones no navegan
await page.goto(url + '#mision');
await page.mouse.click(1000, 400);
ok((await active()) === 'puntos', 'clic a la derecha avanza');
await page.mouse.click(100, 400);
ok((await active()) === 'mision', 'clic a la izquierda retrocede');

ok(pageErrors.length === 0, `sin errores de JavaScript (${pageErrors.join(' | ') || 'ninguno'})`);
await browser.close();
console.log(fail.length ? `\n✗ ${fail.length} fallos` : '\n✓ Interacción verificada.');
process.exit(fail.length ? 1 : 0);
