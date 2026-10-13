// Utilidades para dibujar maquetas SVG con ajuste de líneas preciso.
// Las anchuras se calculan con las métricas reales de Pretendard (fuente del tema
// gradient-pop), extraídas en pretendard-metrics.json.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const METRICS = JSON.parse(readFileSync(path.join(here, 'pretendard-metrics.json'), 'utf8'));

export const FONT =
  "'Pretendard Variable', Pretendard, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function nearestWeight(w) {
  const ws = Object.keys(METRICS.weights).map(Number);
  return String(ws.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a)));
}

/** Ancho aproximado (px) de `text` a `size` px y peso `weight`. */
export function measure(text, size, weight = 400, letterSpacing = 0) {
  const table = METRICS.weights[nearestWeight(weight)];
  let units = 0;
  let extra = 0;
  for (const ch of Array.from(text)) {
    const cp = ch.codePointAt(0);
    if (cp === 0xfe0f || cp === 0x200d) continue;
    const adv = table[String(cp)];
    if (adv !== undefined) units += adv;
    else extra += size * 1.18; // emoji y símbolos fuera de la tabla
  }
  const n = Array.from(text).length;
  return (units / METRICS.upm) * size + extra + letterSpacing * Math.max(0, n - 1);
}

/** Ajuste de línea voraz. Devuelve un array de líneas. */
export function wrap(text, maxWidth, size, weight = 400) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const cand = line ? `${line} ${word}` : word;
    if (measure(cand, size, weight) <= maxWidth || !line) {
      if (!line && measure(word, size, weight) > maxWidth) {
        // palabra larguísima: cortar por caracteres
        let chunk = '';
        for (const ch of Array.from(word)) {
          if (measure(chunk + ch, size, weight) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      } else line = cand;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Bloque de texto multilínea. `y` es la línea base de la primera línea.
 * Devuelve { svg, height, lines, width }.
 */
export function textBlock({ x, y, text, size, weight = 400, fill = '#000', maxWidth, lineHeight, anchor = 'start', extra = '' }) {
  const lh = lineHeight ?? Math.round(size * 1.38);
  const lines = maxWidth ? wrap(text, maxWidth, size, weight) : [String(text)];
  const tspans = lines
    .map((l, i) => `<tspan x="${x}" ${i === 0 ? `y="${y}"` : `dy="${lh}"`}>${esc(l)}</tspan>`)
    .join('');
  const svg = `<text font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${extra ? ' ' + extra : ''}>${tspans}</text>`;
  const width = Math.max(...lines.map((l) => measure(l, size, weight)));
  return { svg, height: lh * (lines.length - 1) + size, lines, width, lineHeight: lh };
}

export const text = (x, y, s, size, weight = 400, fill = '#000', anchor = 'start', extra = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${extra ? ' ' + extra : ''}>${esc(s)}</text>`;

export const rect = (x, y, w, h, r, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;

export function svgDoc({ id, width, height, title, desc, body, defs = '' }) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ` +
    `role="img" aria-labelledby="${id}-title ${id}-desc" font-family="${esc(FONT)}">` +
    `<title id="${id}-title">${esc(title)}</title><desc id="${id}-desc">${esc(desc)}</desc>` +
    (defs ? `<defs>${defs}</defs>` : '') +
    body +
    `</svg>`
  );
}
