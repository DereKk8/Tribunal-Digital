// Ilustraciones inventadas para las maquetas: avatares, logos y escenas.
// Ninguna representa a una persona real. Las caras son dibujos geométricos simples.
import { esc } from './svg-kit.mjs';

let uidCounter = 0;
const uid = (p) => `${p}-${++uidCounter}`;
export const resetUid = () => { uidCounter = 0; };

/** Glifo de la atalaya (torre) en una caja de 100×100, centrado en (0,0) tras traslado. */
export function towerGlyph(fill) {
  return (
    `<path fill="${fill}" d="M26 14h10v9h8v-9h12v9h8v-9h10v22h-6l6 50H26l6-50h-6z"/>` +
    `<path fill="rgba(0,0,0,0.28)" d="M44 86V66a6 6 0 0 1 12 0v20z"/>` +
    `<rect x="45" y="44" width="10" height="10" rx="2" fill="rgba(0,0,0,0.28)"/>`
  );
}

/** Logo cuadrado del club (inventado). */
export function clubLogo(x, y, size, { bg = '#5b21b6', fg = '#facc15', radius = 0.22 } = {}) {
  const s = size / 100;
  return (
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<rect width="100" height="100" rx="${100 * radius}" fill="${bg}"/>` +
    `<g transform="translate(8 6) scale(0.84)">${towerGlyph(fg)}</g></g>`
  );
}

function person({ cx, cy, r, bg, skin, shirt, hair, hairStyle = 'short', cap = null, headset = null, glasses = false }) {
  const id = uid('av');
  const k = r / 100; // dibujo en caja de 200×200 centrada en (0,0)
  let g = `<g transform="translate(${cx} ${cy}) scale(${k})">`;
  g += `<defs><clipPath id="${id}"><circle r="100"/></clipPath></defs>`;
  g += `<g clip-path="url(#${id})">`;
  g += `<circle r="100" fill="${bg}"/>`;
  // torso
  g += `<path d="M-80 110 C-78 55 -40 38 0 38 C40 38 78 55 80 110 Z" fill="${shirt}"/>`;
  // cuello
  g += `<rect x="-14" y="10" width="28" height="34" rx="10" fill="${skin}"/>`;
  // pelo largo detrás
  if (hairStyle === 'long') g += `<path d="M-46 -20 C-50 40 -40 60 -30 64 L30 64 C40 60 50 40 46 -20 Z" fill="${hair}"/>`;
  // cabeza
  g += `<ellipse cx="0" cy="-18" rx="40" ry="46" fill="${skin}"/>`;
  // pelo
  if (hairStyle === 'short') g += `<path d="M-41 -26 C-42 -66 -14 -70 0 -70 C22 -70 42 -60 41 -26 C34 -44 20 -50 0 -50 C-20 -50 -34 -44 -41 -26 Z" fill="${hair}"/>`;
  if (hairStyle === 'long') g += `<path d="M-42 -16 C-46 -66 -10 -72 2 -70 C30 -68 46 -50 42 -14 C38 -40 18 -50 -2 -48 C-22 -46 -36 -36 -42 -16 Z" fill="${hair}"/>`;
  // ojos y sonrisa
  g += `<circle cx="-14" cy="-18" r="4.5" fill="#1f2937"/><circle cx="14" cy="-18" r="4.5" fill="#1f2937"/>`;
  g += `<path d="M-12 4 Q0 13 12 4" stroke="#7c2d12" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  if (glasses) {
    g += `<g stroke="#111827" stroke-width="3.5" fill="none"><circle cx="-14" cy="-18" r="11"/><circle cx="14" cy="-18" r="11"/><path d="M-3 -18h6"/></g>`;
  }
  if (cap) {
    g += `<path d="M-44 -36 C-44 -78 44 -78 44 -36 Z" fill="${cap.color}"/>`;
    g += `<path d="M-10 -40 C10 -46 46 -46 66 -34 C50 -30 20 -32 -10 -34 Z" fill="${cap.brim}"/>`;
    g += `<g transform="translate(-13 -72) scale(0.26)">${towerGlyph(cap.mark)}</g>`;
  }
  if (headset) {
    g += `<path d="M-50 -14 C-52 -84 52 -84 50 -14" stroke="${headset}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
    g += `<rect x="-60" y="-30" width="20" height="34" rx="9" fill="${headset}"/>`;
    g += `<rect x="40" y="-30" width="20" height="34" rx="9" fill="${headset}"/>`;
    g += `<path d="M-50 2 C-50 22 -36 30 -18 30" stroke="${headset}" stroke-width="5" fill="none"/><circle cx="-16" cy="30" r="6" fill="${headset}"/>`;
  }
  g += `</g></g>`;
  return g;
}

function badge({ cx, cy, r, bg, glyph }) {
  return `<g transform="translate(${cx} ${cy})"><circle r="${r}" fill="${bg}"/>${glyph(r)}</g>`;
}

/** Avatares por clave. */
export function avatar(kind, cx, cy, r) {
  switch (kind) {
    case 'rai':
      return person({ cx, cy, r, bg: '#fde68a', skin: '#d79a6b', shirt: '#6d28d9', hair: '#2b1d14', cap: { color: '#5b21b6', brim: '#4c1d95', mark: '#facc15' }, headset: '#facc15' });
    case 'rai-desk':
      return person({ cx, cy, r, bg: 'transparent', skin: '#d79a6b', shirt: '#6d28d9', hair: '#2b1d14', cap: { color: '#5b21b6', brim: '#4c1d95', mark: '#facc15' }, headset: '#facc15' });
    case 'lucia':
      return person({ cx, cy, r, bg: '#bae6fd', skin: '#b9774f', shirt: '#0f766e', hair: '#3b2416', hairStyle: 'long' });
    case 'lucia-desk':
      return person({ cx, cy, r, bg: 'transparent', skin: '#b9774f', shirt: '#0f766e', hair: '#3b2416', hairStyle: 'long', headset: '#e2e8f0' });
    case 'tomas':
      return person({ cx, cy, r, bg: '#bbf7d0', skin: '#f0c19a', shirt: '#475569', hair: '#78350f', glasses: true });
    case 'gil':
      return person({ cx, cy, r, bg: '#e9d5ff', skin: '#c58c63', shirt: '#334155', hair: '#9ca3af', glasses: true });
    case 'atl':
      return badge({ cx, cy, r, bg: '#5b21b6', glyph: (rr) => `<g transform="translate(${-rr * 0.62} ${-rr * 0.66}) scale(${rr * 0.0124})">${towerGlyph('#facc15')}</g>` });
    case 'leo':
      return badge({ cx, cy, r, bg: '#0891b2', glyph: (rr) => `<path transform="scale(${rr / 50})" fill="#ecfeff" d="M0 -32 L8 -9 L32 -9 L13 6 L20 30 L0 16 L-20 30 L-13 6 L-32 -9 L-8 -9 Z"/>` });
    case 'dani':
      return badge({ cx, cy, r, bg: '#ea580c', glyph: (rr) => `<text y="${rr * 0.32}" font-size="${rr * 0.9}" font-weight="800" fill="#fff7ed" text-anchor="middle">DZ</text>` });
    case 'group':
      return badge({ cx, cy, r, bg: '#0f766e', glyph: (rr) => `<text y="${rr * 0.3}" font-size="${rr * 0.82}" font-weight="800" fill="#f0fdfa" text-anchor="middle">LZ</text>` });
    case 'initials-1':
    case 'initials-2':
    case 'initials-3': {
      const colors = { 'initials-1': '#64748b', 'initials-2': '#a16207', 'initials-3': '#be185d' };
      return badge({ cx, cy, r, bg: colors[kind], glyph: () => '' });
    }
    case 'club':
      return clubLogo(cx - r, cy - r, r * 2, { radius: 0.5 });
    default:
      throw new Error(`Avatar desconocido: ${kind}`);
  }
}

/** Hexágono del logo (inventado) de Fractal Arena. */
export function fractalLogo(x, y, h) {
  const s = h / 40;
  return (
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M20 0 L37 10 L37 30 L20 40 L3 30 L3 10 Z" fill="none" stroke="#22d3ee" stroke-width="3.5"/>` +
    `<path d="M20 8 L30 14 L30 26 L20 32 L10 26 L10 14 Z" fill="#22d3ee" opacity="0.35"/>` +
    `<path d="M20 14 L25 17 L25 23 L20 26 L15 23 L15 17 Z" fill="#a5f3fc"/></g>`
  );
}

/** Logo (inventado) de Lumen: sol en degradado azul-verde. */
export function lumenLogo(x, y, size, gid) {
  return (
    `<g transform="translate(${x} ${y})">` +
    `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06b6d4"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs>` +
    `<rect width="${size}" height="${size}" rx="${size * 0.28}" fill="url(#${gid})"/>` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.2}" fill="#fff"/>` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.33}" fill="none" stroke="#fff" stroke-width="${size * 0.06}" stroke-dasharray="${size * 0.12} ${size * 0.09}"/></g>`
  );
}

/** Insignia de verificación (check en círculo). */
export function verifiedBadge(cx, cy, r) {
  return `<g transform="translate(${cx} ${cy})"><circle r="${r}" fill="#2563eb"/><path d="M${-r * 0.45} 0 L${-r * 0.1} ${r * 0.35} L${r * 0.5} ${-r * 0.35}" stroke="#fff" stroke-width="${r * 0.28}" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

/** Icono de temporizador (mensajes temporales). */
export function timerIcon(cx, cy, r, color) {
  return `<g transform="translate(${cx} ${cy})" fill="none" stroke="${color}" stroke-width="${r * 0.22}" stroke-linecap="round"><circle r="${r}"/><path d="M0 ${-r * 0.55} V0 L${r * 0.45} ${r * 0.3}"/><path d="M${-r * 0.35} ${-r * 1.35} H${r * 0.35}"/></g>`;
}

/** Escena de la mesa de narración (publicación del club). */
export function deskScene(x, y, w, h, gid) {
  return (
    `<g transform="translate(${x} ${y})">` +
    `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#312e81"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#${gid})"/>` +
    // pantalla de fondo con el logo
    `<rect x="${w * 0.33}" y="${h * 0.08}" width="${w * 0.34}" height="${h * 0.3}" rx="10" fill="#1e1b4b" stroke="#a78bfa" stroke-width="3"/>` +
    `<g transform="translate(${w * 0.5 - h * 0.1} ${h * 0.11}) scale(${(h * 0.2) / 100})">${towerGlyph('#facc15')}</g>` +
    avatar('rai-desk', w * 0.3, h * 0.6, h * 0.28) +
    avatar('lucia-desk', w * 0.7, h * 0.6, h * 0.28) +
    `<rect x="0" y="${h * 0.76}" width="${w}" height="${h * 0.24}" fill="#111827"/>` +
    `<rect x="${w * 0.06}" y="${h * 0.8}" width="${w * 0.88}" height="${h * 0.04}" rx="4" fill="#facc15" opacity="0.85"/>` +
    `</g>`
  );
}

/** Ilustración simple de la sede del club (publicación de Lumen). */
export function buildingArt(x, y, w, h) {
  return (
    `<g transform="translate(${x} ${y})"><rect width="${w}" height="${h}" fill="#c4b5fd"/>` +
    `<rect x="${w * 0.15}" y="${h * 0.3}" width="${w * 0.7}" height="${h * 0.6}" fill="#4c1d95"/>` +
    `<rect x="${w * 0.42}" y="${h * 0.62}" width="${w * 0.16}" height="${h * 0.28}" fill="#facc15"/>` +
    [0.22, 0.42, 0.62].map((k) => `<rect x="${w * k}" y="${h * 0.38}" width="${w * 0.14}" height="${h * 0.14}" fill="#ede9fe"/>`).join('') +
    `<g transform="translate(${w * 0.4} ${h * 0.05}) scale(${(w * 0.2) / 100})">${towerGlyph('#5b21b6')}</g></g>`
  );
}

export { esc };
