#!/usr/bin/env node
// QA visual de projection/index.html: captura cada diapositiva, detecta desbordes,
// errores de JavaScript y texto que se sale de su contenedor.
// Requiere Playwright (npx playwright o una instalación local/global de «playwright»).
//
// Uso: node projection/build/qa-render.mjs [--width 1600 --height 900] [--out projection/qa-output]
//      [--url http://localhost:8080/presentador/] (para probar contra el servidor real)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const W = Number(arg('--width', 1600));
const H = Number(arg('--height', 900));
const OUT = path.resolve(arg('--out', path.join(ROOT, 'projection', 'qa-output')));
const URL_ARG = arg('--url', null);

function loadPlaywright() {
  const candidates = [process.cwd() + '/', ROOT + '/', '/opt/node-tools/node_modules/', '/usr/lib/node_modules/', '/usr/local/lib/node_modules/'];
  for (const c of candidates) {
    try { return createRequire(c)('playwright'); } catch { /* siguiente */ }
  }
  console.error('✗ No encuentro Playwright. Instálalo con: npm i -D playwright');
  process.exit(2);
}

const { chromium } = loadPlaywright();
mkdirSync(OUT, { recursive: true });
const launchOpts = process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {};
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const target = URL_ARG || pathToFileURL(path.join(ROOT, 'projection', 'index.html')).href;
await page.goto(target);
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;transition-delay:0s!important}.slide .a{opacity:1!important;transform:none!important}' });

const ids = await page.$$eval('.slide', (els) => els.map((e) => e.id));
const report = [];
for (let i = 0; i < ids.length; i++) {
  await page.evaluate((id) => { location.hash = id; }, ids[i]);
  await page.waitForTimeout(120);
  const info = await page.evaluate((id) => {
    const s = document.getElementById(id);
    const sr = s.getBoundingClientRect();
    const issues = [];
    if (!s.classList.contains('active')) issues.push('no se activó');
    if (s.scrollHeight > s.clientHeight + 2) issues.push(`desborde vertical ${s.scrollHeight - s.clientHeight}px`);
    if (s.scrollWidth > s.clientWidth + 2) issues.push(`desborde horizontal ${s.scrollWidth - s.clientWidth}px`);
    // elementos de texto que se salen del escenario
    s.querySelectorAll('p, h1, h2, h3, h4, li, span.chip, .opt, .resp-row, .board-row, .glass-card, .glass-dark').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > sr.right + 1 || r.bottom > sr.bottom + 1 || r.left < sr.left - 1 || r.top < sr.top - 1) {
        issues.push(`fuera del escenario: <${el.tagName.toLowerCase()} class="${el.className}"> ${el.textContent.trim().slice(0, 40)}`);
      }
      if (el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflow === 'hidden' && !el.matches('.resp-cell p')) {
        issues.push(`texto recortado: ${el.textContent.trim().slice(0, 40)}`);
      }
    });
    return { issues, title: s.dataset.title };
  }, ids[i]);
  const file = `${String(i + 1).padStart(2, '0')}-${ids[i]}.png`;
  await page.screenshot({ path: path.join(OUT, file) });
  report.push({ n: i + 1, id: ids[i], title: info.title, file, issues: info.issues });
}
await browser.close();

writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ viewport: [W, H], target, errors, slides: report }, null, 2));
const bad = report.filter((r) => r.issues.length);
console.log(`Capturas: ${report.length} en ${path.relative(ROOT, OUT) || OUT} (${W}×${H})`);
if (errors.length) console.log('Errores JS:\n  ' + errors.join('\n  '));
for (const r of bad) console.log(`✗ ${r.n} ${r.id}: ${r.issues.join(' | ')}`);
if (!bad.length && !errors.length) console.log('✓ Sin desbordes ni errores de JavaScript.');
process.exit(bad.length || errors.length ? 1 : 0);
