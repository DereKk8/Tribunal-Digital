#!/usr/bin/env node
// Dibuja las maquetas de evidencia (SVG) a partir de content/src/case.mjs.
// Todo el texto visible sale de los mismos datos que la transcripción de public.json.
// Uso: node content/tools/render-evidence.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { EVIDENCE } from '../src/case.mjs';
import { evidenceBody } from '../src/evidence-text.mjs';
import { esc, measure, wrap, textBlock, text, rect, svgDoc } from './lib/svg-kit.mjs';
import { avatar, clubLogo, fractalLogo, lumenLogo, verifiedBadge, timerIcon, deskScene, buildingArt, resetUid } from './lib/mock-art.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'assets', 'evidence');

function fail(ev, msg) {
  throw new Error(`${ev.id}: ${msg}`);
}

// ───────────────────────────── Fractal Arena (escritorio) ─────────────────────────────
const GW = 1200, GH = 840;

function gameFrame(tab) {
  const tabW = measure(tab, 16, 800, 2) + 40;
  return (
    rect(0, 0, GW, GH, 22, '#0b1120') +
    rect(0, 0, GW, 68, 22, '#111827') + rect(0, 40, GW, 28, 0, '#111827') +
    `<line x1="0" y1="68" x2="${GW}" y2="68" stroke="#1f2a44" stroke-width="2"/>` +
    fractalLogo(26, 14, 40) +
    text(80, 43, 'FRACTAL ARENA', 22, 800, '#e2e8f0', 'start', 'letter-spacing="4"') +
    rect(1070 - tabW, 18, tabW, 32, 16, '#083344') +
    text(1070 - tabW / 2, 40, tab, 16, 800, '#67e8f9', 'middle', 'letter-spacing="2"') +
    `<g fill="#475569"><rect x="1092" y="33" width="18" height="3" rx="1.5"/><rect x="1124" y="25" width="16" height="16" rx="3" fill="none" stroke="#475569" stroke-width="3"/><path d="M1158 26 l14 14 M1172 26 l-14 14" stroke="#475569" stroke-width="3" stroke-linecap="round"/></g>`
  );
}

function renderGameChat(ev) {
  const c = ev.chat;
  let b = gameFrame('MENSAJES');
  // barra lateral
  b += rect(0, 68, 300, GH - 68, 0, '#0f172a') + rect(0, GH - 22, 300, 22, 0, '#0b1120');
  b += `<path d="M0 ${GH - 22} H300 V${GH} H22 A22 22 0 0 1 0 ${GH - 22} Z" fill="#0f172a"/>`;
  b += text(28, 112, 'CONVERSACIONES', 16, 800, '#64748b', 'start', 'letter-spacing="2"');
  const others = ['RaiCoach_ATL', 'DaniZurdo'].filter((h) => h !== c.other.handle);
  const entries = [
    { handle: c.other.handle, avatar: c.other.avatar, sub: 'Mensaje directo', active: true },
    ...others.map((h) => ({ handle: h, avatar: h === 'DaniZurdo' ? 'dani' : 'atl', sub: 'Mensaje directo', active: false })),
    { handle: 'Los Zurdos', avatar: 'group', sub: 'Clan · 9 miembros', active: false },
  ];
  entries.forEach((e, i) => {
    const y = 132 + i * 84;
    if (e.active) b += rect(12, y, 276, 76, 14, '#1e293b') + rect(12, y + 18, 5, 40, 2.5, '#22d3ee');
    b += avatar(e.avatar, 58, y + 38, 24);
    b += text(94, y + 34, e.handle, 20, 700, e.active ? '#f1f5f9' : '#94a3b8');
    b += text(94, y + 59, e.sub, 15, 500, '#64748b');
  });
  // cabecera del chat
  b += avatar(c.other.avatar, 352, 116, 30);
  b += text(396, 108, c.other.handle, 26, 800, '#f8fafc');
  b += text(396, 138, c.other.line, 18, 500, '#94a3b8');
  b += `<line x1="300" y1="166" x2="${GW}" y2="166" stroke="#1f2a44" stroke-width="2"/>`;
  // separador de día
  const dayW = measure(c.day, 15, 800, 1.5) + 40;
  b += rect(750 - dayW / 2, 184, dayW, 32, 16, '#1e293b') + text(750, 205, c.day, 15, 800, '#94a3b8', 'middle', 'letter-spacing="1.5"');
  // mensajes
  let y = 236;
  const FS = 23, LH = 31, PX = 20, PY = 15, MAXW = 600;
  for (const m of c.messages) {
    const mine = m.from === c.me;
    const lines = wrap(m.text, MAXW, FS, 500);
    const w = Math.max(...lines.map((l) => measure(l, FS, 500))) + PX * 2;
    const h = lines.length * LH + PY * 2 - (LH - FS) + 4;
    const x = mine ? 1170 - w : 330;
    b += rect(x, y, w, h, 18, mine ? '#0e7490' : '#1e293b');
    const tb = textBlock({ x: x + PX, y: y + PY + FS - 3, text: m.text, size: FS, weight: 500, fill: mine ? '#ecfeff' : '#e2e8f0', maxWidth: MAXW, lineHeight: LH });
    b += tb.svg;
    b += mine
      ? text(x - 12, y + h - 10, m.t, 16, 600, '#64748b', 'end')
      : text(x + w + 12, y + h - 10, m.t, 16, 600, '#64748b');
    y += h + 16;
  }
  if (y > GH - 76) fail(ev, `los mensajes desbordan (${y})`);
  b += rect(318, GH - 62, 862, 46, 23, '#1e293b') + text(344, GH - 32, 'Escribe un mensaje…', 18, 500, '#64748b');
  return { w: GW, h: GH, body: b };
}

function renderGameProfile(ev) {
  const p = ev.profile;
  let b = gameFrame('PERFIL');
  b += rect(36, 96, 400, 712, 22, '#111a2e');
  b += avatar(p.avatar, 236, 236, 92);
  b += text(236, 372, p.handle, 32, 800, '#f8fafc', 'middle');
  b += text(236, 418, 'BIO', 15, 800, '#64748b', 'middle', 'letter-spacing="2"');
  b += textBlock({ x: 236, y: 452, text: p.bio, size: 22, weight: 500, fill: '#cbd5e1', maxWidth: 340, anchor: 'middle' }).svg;
  b += text(476, 128, 'ESTADÍSTICAS', 16, 800, '#64748b', 'start', 'letter-spacing="2"');
  const TW = 333, TH = 104;
  p.stats.forEach(([k, v], i) => {
    const x = 476 + (i % 2) * (TW + 24);
    const y = 146 + Math.floor(i / 2) * (TH + 18);
    b += rect(x, y, TW, TH, 16, '#111a2e');
    b += text(x + 22, y + 36, k.toUpperCase(), 15, 700, '#94a3b8', 'start', 'letter-spacing="1"');
    let size = 30;
    while (measure(v, size, 800) > TW - 44 && size > 18) size -= 1;
    b += text(x + 22, y + 80, v, size, 800, '#f1f5f9');
  });
  let y = 146 + 3 * (TH + 18) + 26;
  if (p.history) {
    b += text(476, y, 'HISTORIAL RECIENTE', 16, 800, '#64748b', 'start', 'letter-spacing="2"');
    y += 18;
    for (const [d, mode, res] of p.history) {
      b += rect(476, y, 690, 62, 14, '#111a2e');
      b += text(500, y + 40, d, 21, 700, '#e2e8f0');
      const pillW = measure(mode, 17, 700) + 28;
      const ranked = mode === 'Clasificatoria';
      b += rect(660, y + 15, pillW, 32, 16, ranked ? '#155e75' : '#334155');
      b += text(660 + pillW / 2, y + 37, mode, 17, 700, ranked ? '#a5f3fc' : '#cbd5e1', 'middle');
      b += text(1142, y + 40, res, 21, 800, res.startsWith('Victoria') ? '#4ade80' : '#f87171', 'end');
      y += 74;
    }
  }
  if (p.status) {
    b += `<circle cx="${236 - measure(p.status, 20, 700) / 2 - 14}" cy="752" r="8" fill="#22c55e"/>`;
    b += text(236 + 10, 759, p.status, 20, 700, '#86efac', 'middle');
  }
  return { w: GW, h: GH, body: b };
}

function renderGameNotification(ev) {
  const n = ev.notification;
  let b = gameFrame('NOTIFICACIONES');
  b += `<rect x="0" y="68" width="${GW}" height="${GH - 68}" fill="#111827" opacity="0.6"/>`;
  for (let i = 0; i < 9; i++) b += `<path d="M${80 + i * 130} 760 l60 -34 l60 34 l0 68 l-60 34 l-60 -34 z" fill="none" stroke="#1e293b" stroke-width="3"/>`;
  b += rect(240, 120, 720, 660, 28, '#111a2e', 'stroke="#155e75" stroke-width="3"');
  b += text(930, 168, n.time, 18, 600, '#64748b', 'end');
  b += text(270, 168, `Para: ${n.to}`, 18, 600, '#64748b');
  // icono de regalo
  b += `<g transform="translate(600 262)"><rect x="-58" y="-26" width="116" height="78" rx="10" fill="#f59e0b"/><rect x="-66" y="-46" width="132" height="30" rx="8" fill="#fbbf24"/><rect x="-10" y="-46" width="20" height="98" fill="#be123c"/><path d="M0 -46 C-30 -90 -62 -56 -24 -46 Z M0 -46 C30 -90 62 -56 24 -46 Z" fill="#e11d48"/></g>`;
  b += text(600, 360, 'REGALO RECIBIDO', 17, 800, '#67e8f9', 'middle', 'letter-spacing="3"');
  const t = textBlock({ x: 600, y: 410, text: n.title, size: 34, weight: 800, fill: '#f8fafc', maxWidth: 620, anchor: 'middle', lineHeight: 42 });
  b += t.svg;
  let y = 410 + t.height + 24;
  const msg = textBlock({ x: 600, y: y + 62, text: `“${n.message}”`, size: 25, weight: 500, fill: '#e2e8f0', maxWidth: 580, anchor: 'middle', lineHeight: 34 });
  b += rect(290, y, 620, msg.height + 72, 18, '#0b1120');
  b += text(600, y + 30, 'MENSAJE', 14, 800, '#64748b', 'middle', 'letter-spacing="2"');
  b += msg.svg;
  y += msg.height + 72 + 30;
  const stW = measure(`✓ ${n.status}`, 20, 800) + 40;
  b += rect(600 - stW / 2, y, stW, 40, 20, '#14532d') + text(600, y + 27, `✓ ${n.status}`, 20, 800, '#86efac', 'middle');
  b += text(600, y + 84, n.balance, 21, 600, '#cbd5e1', 'middle');
  if (y + 100 > 780) fail(ev, 'la notificación desborda');
  return { w: GW, h: GH, body: b };
}

// ───────────────────────────── Web del club ─────────────────────────────
const WW = 1200, WH = 900;

function browserFrame(w) {
  const tabTitle = `Club Atalaya eSports · ${w.title}`;
  let b = rect(0, 0, WW, WH, 16, '#ffffff');
  b += rect(0, 0, WW, 96, 16, '#e5e7eb') + rect(0, 60, WW, 36, 0, '#e5e7eb');
  b += `<circle cx="28" cy="22" r="7" fill="#f87171"/><circle cx="50" cy="22" r="7" fill="#fbbf24"/><circle cx="72" cy="22" r="7" fill="#34d399"/>`;
  b += `<path d="M100 40 V14 a8 8 0 0 1 8 -8 H${Math.min(560, 140 + measure(tabTitle, 15, 600))} a8 8 0 0 1 8 8 V40 Z" fill="#ffffff"/>`;
  b += clubLogo(114, 13, 20, { radius: 0.3 });
  b += text(142, 29, tabTitle, 15, 600, '#374151');
  b += rect(110, 52, 980, 36, 18, '#ffffff', 'stroke="#d1d5db"');
  b += `<g transform="translate(134 61)" fill="#6b7280"><rect x="0" y="7" width="13" height="10" rx="2"/><path d="M3 7 V4 a3.5 3.5 0 0 1 7 0 V7" stroke="#6b7280" stroke-width="2" fill="none"/></g>`;
  b += text(158, 76, w.url, 18, 500, '#374151');
  // cabecera del sitio
  b += rect(0, 96, WW, 76, 0, '#4c1d95');
  b += clubLogo(40, 108, 52, { radius: 0.25 });
  b += text(106, 137, 'CLUB ATALAYA', 23, 900, '#ffffff', 'start', 'letter-spacing="2"');
  b += text(106, 158, 'eSPORTS', 14, 800, '#facc15', 'start', 'letter-spacing="3"');
  const nav = ['Inicio', 'Semillero', 'Noticias', 'Contacto'];
  let nx = 1150;
  for (const item of [...nav].reverse()) {
    const iw = measure(item, 18, 600);
    nx -= iw;
    b += text(nx, 141, item, 18, 600, item === 'Semillero' ? '#ffffff' : '#ddd6fe');
    if (item === 'Semillero') b += rect(nx, 150, iw, 3, 1.5, '#facc15');
    nx -= 34;
  }
  return b;
}

function renderWeb(ev) {
  const w = ev.web;
  let b = browserFrame(w);
  let y = 214;
  b += text(60, y, w.published, 16, 600, '#6b7280');
  y += 50;
  b += text(60, y, w.title, 44, 900, '#3b0764', 'start', 'letter-spacing="-1"');
  if (w.subtitle) {
    y += 40;
    const st = textBlock({ x: 60, y, text: w.subtitle, size: 23, weight: 500, fill: '#4b5563', maxWidth: 1080 });
    b += st.svg;
    y += st.height;
  }
  y += 30;
  if (w.blocks) {
    const CW = (1080 - 2 * 24) / 3;
    const blocks = w.blocks.map((bl) => textBlock({ x: 0, y: 0, text: bl.text, size: 20, weight: 500, fill: '#1f2937', maxWidth: CW - 44, lineHeight: 28 }));
    const ch = Math.max(...blocks.map((t) => t.height)) + 96;
    w.blocks.forEach((bl, i) => {
      const x = 60 + i * (CW + 24);
      b += rect(x, y, CW, ch, 18, '#f5f3ff', 'stroke="#ddd6fe" stroke-width="2"');
      b += text(x + 22, y + 42, bl.head, 21, 800, '#5b21b6');
      b += textBlock({ x: x + 22, y: y + 80, text: bl.text, size: 20, weight: 500, fill: '#1f2937', maxWidth: CW - 44, lineHeight: 28 }).svg;
    });
    y += ch + 46;
  }
  if (w.staff) {
    b += text(60, y, w.staffTitle, 26, 900, '#3b0764');
    y += 26;
    w.staff.forEach((s, i) => {
      const x = 60 + i * 360;
      b += rect(x, y, 336, 112, 18, '#faf5ff', 'stroke="#ede9fe" stroke-width="2"');
      b += avatar(s.avatar, x + 58, y + 56, 40);
      b += text(x + 112, y + 50, s.name, 22, 800, '#1f2937');
      b += text(x + 112, y + 80, s.role, 18, 500, '#6b7280');
    });
    y += 112 + 40;
    const note = textBlock({ x: 60, y, text: w.staffNote, size: 20, weight: 500, fill: '#374151', maxWidth: 1080 });
    b += note.svg;
    y += note.height;
    if (w.safeguarding) {
      y += 32;
      b += text(60, y, w.safeguarding, 20, 700, '#5b21b6');
    }
  }
  if (w.faq) {
    for (const f of w.faq) {
      b += `<line x1="60" y1="${y - 6}" x2="1140" y2="${y - 6}" stroke="#ede9fe" stroke-width="2"/>`;
      y += 40;
      b += rect(60, y - 26, 30, 30, 8, '#5b21b6') + text(75, y - 4, '?', 20, 900, '#facc15', 'middle');
      b += text(106, y, f.q, 24, 800, '#3b0764');
      y += 42;
      const a = textBlock({ x: 106, y, text: f.a, size: 22, weight: 500, fill: '#1f2937', maxWidth: 1030, lineHeight: 32 });
      b += a.svg;
      y += a.height + 34;
    }
  }
  if (y > WH - 20) fail(ev, `la página desborda (${y})`);
  return { w: WW, h: WH, body: b };
}

// ───────────────────────────── Correo ─────────────────────────────
const EW = 1200, EH = 860;

function renderEmail(ev) {
  const e = ev.email;
  let b = rect(0, 0, EW, '__EH__', 16, '#f1f5f9');
  b += rect(0, 0, 80, '__EH__', 16, '#1e293b') + rect(40, 0, 40, '__EH__', 0, '#1e293b');
  for (let i = 0; i < 4; i++) b += rect(24, 96 + i * 64, 32, 32, 9, i === 0 ? '#38bdf8' : '#475569');
  b += rect(80, 0, EW - 80, 66, 0, '#ffffff') + `<line x1="80" y1="66" x2="${EW}" y2="66" stroke="#e2e8f0" stroke-width="2"/>`;
  b += text(108, 43, 'Correo', 24, 800, '#0f172a');
  b += rect(300, 15, 560, 36, 18, '#f1f5f9') + text(326, 39, 'Buscar en el correo', 16, 500, '#94a3b8');
  b += rect(100, 84, EW - 120, '__EH104__', 18, '#ffffff', 'stroke="#e2e8f0" stroke-width="2"');
  let y = 140;
  const sub = textBlock({ x: 136, y, text: e.subject, size: 30, weight: 800, fill: '#0f172a', maxWidth: 1000 });
  b += sub.svg;
  y += sub.height + 34;
  const initial = e.from.trim().charAt(0).toUpperCase();
  b += `<circle cx="162" cy="${y + 10}" r="27" fill="${e.from.includes('Inscripciones') ? '#0f766e' : '#7c3aed'}"/>` + text(162, y + 19, initial, 24, 800, '#ffffff', 'middle');
  b += text(204, y + 4, e.from, 20, 700, '#0f172a');
  b += text(1140, y + 4, e.date, 17, 600, '#64748b', 'end');
  b += text(204, y + 34, `Para: ${e.to}${e.cc ? `   ·   CC: ${e.cc}` : ''}`, 17, 500, '#475569');
  y += 74;
  b += `<line x1="136" y1="${y}" x2="1140" y2="${y}" stroke="#e2e8f0" stroke-width="2"/>`;
  y += 48;
  for (const p of e.paragraphs) {
    const t = textBlock({ x: 136, y, text: p, size: 23, weight: 500, fill: '#1e293b', maxWidth: 1000, lineHeight: 34 });
    b += t.svg;
    y += t.height + 24;
  }
  y += 6;
  b += textBlock({ x: 136, y, text: e.signature, size: 19, weight: 600, fill: '#64748b', maxWidth: 1000 }).svg;
  const h = Math.max(560, Math.ceil((y + 70) / 10) * 10);
  if (h > EH) fail(ev, `el correo desborda (${y})`);
  return { w: EW, h, body: b.replace(/__EH__/g, String(h)).replace(/__EH20__/g, String(h - 20)).replace(/__EH104__/g, String(h - 104)) };
}

// ───────────────────────────── Teléfono ─────────────────────────────
const PW = 600, PH = 1100;
const SX = 18, SY = 18, SW = PW - 36, SH = PH - 36;

function phoneFrame(screenBg, clock, statusDark = false, clipId) {
  const fg = statusDark ? '#ffffff' : '#0f172a';
  return {
    open:
      rect(0, 0, PW, PH, 66, '#0f172a') +
      `<clipPath id="${clipId}"><rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="50"/></clipPath>` +
      `<g clip-path="url(#${clipId})">` + rect(SX, SY, SW, SH, 0, screenBg),
    status: (bg) =>
      rect(SX, SY, SW, 52, 0, bg) +
      text(70, 58, clock, 20, 800, fg) +
      `<g fill="${fg}"><rect x="438" y="48" width="5" height="10" rx="1"/><rect x="446" y="44" width="5" height="14" rx="1"/><rect x="454" y="40" width="5" height="18" rx="1"/><rect x="474" y="40" width="40" height="18" rx="5" fill="none" stroke="${fg}" stroke-width="2.5"/><rect x="478" y="44" width="28" height="10" rx="2"/><rect x="516" y="45" width="3" height="8" rx="1"/></g>` +
      rect(240, 24, 120, 30, 15, '#0f172a'),
    close: `</g>`,
  };
}

function renderPhoneChat(ev) {
  const p = ev.phone;
  const f = phoneFrame('#eef2ff', p.clock, true, `${ev.id}-clip`);
  let b = f.open + rect(SX, SY, SW, 170, 0, '#312e81') + f.status('#312e81');
  b += `<path d="M58 118 l-14 -14 l14 -14" stroke="#e0e7ff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  b += `<circle cx="104" cy="118" r="28" fill="#6d28d9"/>` + text(104, 128, 'R', 26, 800, '#ede9fe', 'middle');
  b += text(146, 112, p.contact, 25, 800, '#ffffff');
  b += timerIcon(156, 138, 8, '#c7d2fe') + text(172, 144, p.sub, 17, 600, '#c7d2fe');
  let y = 206;
  const dayW = measure(p.day, 14, 800, 1.5) + 36;
  b += rect(300 - dayW / 2, y, dayW, 30, 15, '#c7d2fe') + text(300, y + 20, p.day, 14, 800, '#3730a3', 'middle', 'letter-spacing="1.5"');
  y += 48;
  if (p.notice) {
    const nt = textBlock({ x: 300, y: y + 30, text: p.notice, size: 18, weight: 600, fill: '#713f12', maxWidth: 420, anchor: 'middle', lineHeight: 25 });
    b += rect(60, y, 480, nt.height + 36, 16, '#fef9c3', 'stroke="#fde68a" stroke-width="2"');
    b += timerIcon(84, y + 26, 8, '#a16207');
    b += nt.svg;
    y += nt.height + 36 + 20;
  }
  const FS = 24, LH = 32, PX = 18, PY = 13, MAXW = 380;
  for (const m of p.messages) {
    const mine = m.from === 'Leo';
    const lines = wrap(m.text, MAXW, FS, 500);
    const tw = Math.max(...lines.map((l) => measure(l, FS, 500)), measure(m.t, 15, 600) + 10);
    const w = tw + PX * 2;
    const h = lines.length * LH + PY * 2 + 22 - (LH - FS);
    const x = mine ? 552 - w : 48;
    b += rect(x, y, w, h, 18, mine ? '#c7d2fe' : '#ffffff', mine ? '' : 'stroke="#e0e7ff" stroke-width="2"');
    b += textBlock({ x: x + PX, y: y + PY + FS - 3, text: m.text, size: FS, weight: 500, fill: '#1e1b4b', maxWidth: MAXW, lineHeight: LH }).svg;
    b += text(x + w - PX, y + h - 11, m.t, 15, 600, '#6366f1', 'end');
    y += h + 14;
  }
  if (y > PH - 120) fail(ev, `el chat desborda (${y})`);
  b += rect(SX, PH - 112, SW, 94, 0, '#ffffff') + rect(44, PH - 96, 440, 50, 25, '#eef2ff') + text(70, PH - 64, 'Mensaje', 19, 500, '#94a3b8');
  b += `<circle cx="522" cy="${PH - 71}" r="25" fill="#4338ca"/><path d="M512 ${PH - 80} l22 9 l-22 9 z" fill="#ffffff"/>`;
  b += f.close;
  return { w: PW, h: PH, body: b };
}

function renderGroupInfo(ev) {
  const g = ev.group;
  const f = phoneFrame('#f8fafc', '18:20', false, `${ev.id}-clip`);
  let b = f.open + f.status('#ffffff') + rect(SX, 70, SW, 70, 0, '#ffffff');
  b += `<path d="M56 116 l-14 -14 l14 -14" stroke="#312e81" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  b += text(80, 112, 'Info. del grupo', 22, 800, '#0f172a');
  b += `<line x1="${SX}" y1="140" x2="${SX + SW}" y2="140" stroke="#e2e8f0" stroke-width="2"/>`;
  b += avatar('group', 300, 222, 62);
  b += text(300, 326, g.name, 28, 800, '#0f172a', 'middle');
  b += text(300, 358, `${g.meta} · ${g.created}`, 17, 600, '#64748b', 'middle');
  let y = 388;
  b += rect(40, y, 520, 64, 16, '#ffffff', 'stroke="#e2e8f0" stroke-width="2"') + timerIcon(74, y + 33, 10, '#334155') + text(98, y + 40, g.temporal, 20, 700, '#1e293b');
  y += 82;
  const d = textBlock({ x: 64, y: y + 62, text: g.description, size: 20, weight: 500, fill: '#1e293b', maxWidth: 472, lineHeight: 28 });
  b += rect(40, y, 520, d.height + 84, 16, '#ffffff', 'stroke="#e2e8f0" stroke-width="2"');
  b += text(64, y + 32, 'DESCRIPCIÓN', 14, 800, '#64748b', 'start', 'letter-spacing="2"');
  b += d.svg;
  y += d.height + 84 + 30;
  b += text(48, y, `${g.meta.split('·')[1].trim().toUpperCase()}`, 15, 800, '#64748b', 'start', 'letter-spacing="2"');
  y += 16;
  const av = ['gil', 'dani', 'leo', 'initials-1'];
  g.members.forEach((m, i) => {
    b += rect(40, y, 520, 74, 0, '#ffffff');
    b += avatar(av[i] || 'initials-2', 82, y + 37, 24);
    b += text(120, y + (m.note && m.note !== 'Admin' ? 32 : 44), m.name, 21, 700, '#0f172a');
    if (m.note === 'Admin') b += rect(470, y + 22, 70, 30, 15, '#dcfce7') + text(505, y + 43, 'Admin', 15, 800, '#166534', 'middle');
    else if (m.note) b += text(120, y + 58, m.note, 16, 500, '#64748b');
    b += `<line x1="120" y1="${y + 74}" x2="560" y2="${y + 74}" stroke="#f1f5f9" stroke-width="2"/>`;
    y += 76;
  });
  if (y > PH - 40) fail(ev, `la info del grupo desborda (${y})`);
  b += f.close;
  return { w: PW, h: PH, body: b };
}

function renderLumenProfile(ev) {
  const l = ev.lumen;
  const f = phoneFrame('#ffffff', '19:05', false, `${ev.id}-clip`);
  let b = f.open + f.status('#ffffff');
  b += `<path d="M56 112 l-14 -14 l14 -14" stroke="#0f172a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  b += text(300, 108, l.handle, 23, 800, '#0f172a', 'middle');
  b += `<g fill="#0f172a"><circle cx="520" cy="100" r="3.5"/><circle cx="532" cy="100" r="3.5"/><circle cx="544" cy="100" r="3.5"/></g>`;
  b += avatar(l.avatar, 120, 236, 78);
  l.counts.forEach(([n, w], i) => {
    const cx = 284 + i * 102;
    b += text(cx, 232, n, 27, 800, '#0f172a', 'middle');
    b += text(cx, 260, w, 15, 500, '#475569', 'middle');
  });
  let y = 360;
  b += text(44, y, l.name, 23, 800, '#0f172a');
  if (l.verified) b += verifiedBadge(44 + measure(l.name, 23, 800) + 18, y - 8, 11);
  y += 36;
  const bio = textBlock({ x: 44, y, text: l.bio, size: 21, weight: 500, fill: '#1e293b', maxWidth: 510, lineHeight: 29 });
  b += bio.svg;
  y += bio.height + 34;
  b += `<g transform="translate(44 ${y - 18})" fill="none" stroke="#64748b" stroke-width="2.5"><rect x="0" y="2" width="20" height="18" rx="3"/><path d="M0 8 H20 M5 0 V4 M15 0 V4"/></g>`;
  b += text(74, y, l.joined, 18, 600, '#475569');
  y += 34;
  b += rect(44, y, 248, 46, 12, '#2563eb') + text(168, y + 30, 'Seguir', 19, 800, '#ffffff', 'middle');
  b += rect(306, y, 248, 46, 12, '#e2e8f0') + text(430, y + 30, 'Mensaje', 19, 800, '#0f172a', 'middle');
  y += 74;
  b += `<line x1="${SX}" y1="${y}" x2="${SX + SW}" y2="${y}" stroke="#e2e8f0" stroke-width="2"/>`;
  y += 4;
  const S = (SW - 4) / 3;
  l.posts.forEach((kind, i) => {
    const x = SX + i * (S + 2);
    if (kind === 'sede') b += buildingArt(x, y, S, S);
    else b += rect(x, y, S, S, 0, kind === 'logo' ? '#4c1d95' : '#facc15') + clubLogo(x + S * 0.2, y + S * 0.2, S * 0.6, kind === 'logo' ? {} : { bg: '#4c1d95', fg: '#facc15' });
  });
  y += S + 20;
  if (y > PH - 40) fail(ev, `el perfil desborda (${y})`);
  b += f.close;
  return { w: PW, h: PH, body: b };
}

function renderLumenPost(ev) {
  const p = ev.post;
  const f = phoneFrame('#ffffff', '09:52', false, `${ev.id}-clip`);
  let b = f.open + f.status('#ffffff');
  b += lumenLogo(40, 80, 40, `${ev.id}-lg`) + text(92, 109, 'Lumen', 26, 800, '#0f172a');
  b += `<line x1="${SX}" y1="140" x2="${SX + SW}" y2="140" stroke="#e2e8f0" stroke-width="2"/>`;
  b += avatar('club', 72, 192, 30);
  b += text(116, 186, p.name, 21, 800, '#0f172a');
  if (p.verified) b += verifiedBadge(116 + measure(p.name, 21, 800) + 16, 179, 10);
  b += text(116, 214, `${p.handle} · ${p.time}`, 17, 500, '#64748b');
  const IY = 244, IH = 330;
  b += deskScene(SX, IY, SW, IH, `${ev.id}-desk`);
  const liveW = measure(`● ${p.live}`, 17, 800, 1) + 28;
  b += rect(40, IY + 18, liveW, 34, 17, '#dc2626') + text(54, IY + 41, `● ${p.live}`, 17, 800, '#ffffff', 'start', 'letter-spacing="1"');
  let y = IY + IH + 44;
  b += `<g fill="none" stroke="#0f172a" stroke-width="3"><path d="M54 ${y - 22} c-8 -10 -24 -8 -24 6 c0 12 24 26 24 26 s24 -14 24 -26 c0 -14 -16 -16 -24 -6 z"/><path d="M108 ${y - 24} h30 a6 6 0 0 1 6 6 v18 a6 6 0 0 1 -6 6 h-18 l-10 8 v-8 h-2 a6 6 0 0 1 -6 -6 v-18 a6 6 0 0 1 6 -6 z"/></g>`;
  b += text(164, y - 2, '1.204 me gusta · 87 comentarios', 17, 600, '#334155');
  y += 42;
  const cap = textBlock({ x: 40, y, text: `${p.live}: ${p.text}`, size: 22, weight: 500, fill: '#0f172a', maxWidth: 520, lineHeight: 31 });
  b += text(40, y, `${p.handle}`, 22, 800, '#0f172a');
  // Pie de foto: la cuenta y luego el texto en línea aparte para legibilidad
  b += textBlock({ x: 40, y: y + 34, text: `${p.live}: ${p.text}`, size: 22, weight: 500, fill: '#0f172a', maxWidth: 520, lineHeight: 31 }).svg;
  y += 34 + cap.height;
  if (y > PH - 40) fail(ev, `la publicación desborda (${y})`);
  b += f.close;
  return { w: PW, h: PH, body: b };
}

function renderPlatformNotice(ev) {
  const n = ev.notice;
  const f = phoneFrame('#f1f5f9', '08:41', false, `${ev.id}-clip`);
  let b = f.open + f.status('#ffffff') + rect(SX, 70, SW, 76, 0, '#ffffff');
  b += lumenLogo(40, 84, 40, `${ev.id}-lg`);
  b += text(92, 112, 'Centro de Seguridad', 23, 800, '#0f172a');
  b += `<line x1="${SX}" y1="146" x2="${SX + SW}" y2="146" stroke="#e2e8f0" stroke-width="2"/>`;
  // escudo
  b += `<g transform="translate(300 236)"><path d="M0 -62 L52 -42 V4 C52 40 26 60 0 70 C-26 60 -52 40 -52 4 V-42 Z" fill="#2563eb"/><path d="M-20 2 L-4 18 L24 -14" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  b += text(300, 346, n.ref, 22, 800, '#1d4ed8', 'middle');
  b += text(300, 376, `Para: ${n.to} · ${n.time}`, 16, 600, '#64748b', 'middle');
  let y = 408;
  const stW = measure(n.status, 19, 800) + 44;
  b += rect(300 - stW / 2, y, stW, 42, 21, '#fee2e2') + text(300, y + 28, n.status, 19, 800, '#991b1b', 'middle');
  y += 70;
  const blocks = n.paragraphs.map((p) => textBlock({ x: 0, y: 0, text: p, size: 22, weight: 500, fill: '#1e293b', maxWidth: 468, lineHeight: 31 }));
  const cardH = blocks.reduce((a, t) => a + t.height + 22, 0) + 40;
  b += rect(40, y, 520, cardH, 20, '#ffffff', 'stroke="#e2e8f0" stroke-width="2"');
  let ty = y + 46;
  n.paragraphs.forEach((p, i) => {
    b += textBlock({ x: 66, y: ty, text: p, size: 22, weight: 500, fill: '#1e293b', maxWidth: 468, lineHeight: 31 }).svg;
    ty += blocks[i].height + 22;
  });
  y += cardH + 28;
  b += rect(40, y, 520, 54, 14, '#e2e8f0') + text(300, y + 35, 'Reportar otra cuenta', 19, 800, '#0f172a', 'middle');
  if (y + 60 > PH - 30) fail(ev, `el aviso desborda (${y})`);
  b += f.close;
  return { w: PW, h: PH, body: b };
}

const RENDERERS = {
  'game-chat': renderGameChat,
  'game-profile': renderGameProfile,
  'game-notification': renderGameNotification,
  web: renderWeb,
  email: renderEmail,
  'phone-chat': renderPhoneChat,
  'group-info': renderGroupInfo,
  'lumen-profile': renderLumenProfile,
  'lumen-post': renderLumenPost,
  'platform-notice': renderPlatformNotice,
};

export function renderEvidence(ev) {
  resetUid();
  const r = RENDERERS[ev.kind];
  if (!r) throw new Error(`Sin renderizador para ${ev.kind}`);
  const { w, h, body } = r(ev);
  // Prefijar ids internos (clipPath, gradientes) con el id de la evidencia para poder incrustar varias en una página.
  const prefixed = body.replace(/id="(av-\d+)"/g, `id="${ev.id}-$1"`).replace(/url\(#(av-\d+)\)/g, `url(#${ev.id}-$1)`);
  return svgDoc({ id: ev.id, width: w, height: h, title: `${ev.id} · ${ev.label}`, desc: evidenceBody(ev), body: prefixed });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(OUT, { recursive: true });
  for (const ev of EVIDENCE) {
    const svg = renderEvidence(ev);
    writeFileSync(path.join(OUT, `${ev.id}.svg`), svg + '\n', 'utf8');
    console.log(`✓ ${ev.id}.svg (${(svg.length / 1024).toFixed(1)} KB)`);
  }
}

export { esc };
