// Genera las imágenes SVG de marcador de posición para las evidencias DEMO.
// Uso: node scripts/generate-demo-assets.js
// Lee fixtures/demo/content/public.json y escribe un SVG legible por evidencia.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const demoRoot = path.join(root, 'fixtures', 'demo');
const publicCase = JSON.parse(readFileSync(path.join(demoRoot, 'content', 'public.json'), 'utf8'));

const escapeXml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

function wrap(text, max) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max) {
      lines.push(line.trim());
      line = w;
    } else {
      line += ' ' + w;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

mkdirSync(path.join(demoRoot, 'assets'), { recursive: true });
for (const round of publicCase.rounds) {
  for (const ev of round.evidence) {
    const lines = wrap(ev.body, 34);
    const textLines = lines
      .map((l, i) => `<text x="40" y="${200 + i * 44}" font-size="32" fill="#1b1b1b">${escapeXml(l)}</text>`)
      .join('\n  ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450" role="img" aria-label="${escapeXml(ev.id + ': ' + ev.body)}">
  <rect width="800" height="450" fill="#fffbe6"/>
  <rect x="0" y="0" width="800" height="64" fill="#b00020"/>
  <text x="40" y="43" font-family="sans-serif" font-size="26" font-weight="700" fill="#ffffff">DEMO — DATOS FICTICIOS DE PRUEBA</text>
  <text x="40" y="130" font-family="sans-serif" font-size="40" font-weight="700" fill="#1b1b1b">Evidencia ${escapeXml(ev.id)}</text>
  <g font-family="sans-serif">
  ${textLines}
  </g>
  <rect x="8" y="8" width="784" height="434" fill="none" stroke="#b00020" stroke-width="6" stroke-dasharray="18 10"/>
</svg>
`;
    writeFileSync(path.join(demoRoot, ev.asset_path), svg);
    console.log('Escrito', ev.asset_path);
  }
}
