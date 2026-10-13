#!/usr/bin/env node
// Construye projection/index.html (make-slide · tema gradient-pop) y content/projection-map.json.
// Fuentes: content/src/case.mjs (datos públicos), assets/evidence/*.svg, assets/fonts/,
// projection/build/vendor/gradient-pop-reference.html (CSS original del tema),
// projection/build/deck.css y projection/build/deck-runtime.js.
// Este script NO lee ningún archivo privado.
//
// Uso: node projection/build/build-deck.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CASE_INFO, TEAMS, CHARACTERS, GLOSSARY, EVIDENCE, ROUNDS, GAME_ID, SCHEMA_VERSION, claimId, actionId } from '../../content/src/case.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ───────────────────────── Tema: CSS original de gradient-pop ─────────────────────────
const reference = read('projection/build/vendor/gradient-pop-reference.html');
const refCss = reference.match(/<style>([\s\S]*?)<\/style>/)[1];
// El bloque responsive del tema se sustituye por el escenario 16:9 escalado (html-spec de make-slide).
const RESPONSIVE_START = refCss.indexOf('/* ========================================\n       RESPONSIVE');
const themeCss = (RESPONSIVE_START > -1 ? refCss.slice(0, RESPONSIVE_START) : refCss).trimEnd();
if (!themeCss.includes('--grad-start: #6366f1') || !themeCss.includes('.slide-grad-11')) {
  throw new Error('El CSS de referencia de gradient-pop no tiene la forma esperada.');
}
const extCss = read('projection/build/deck.css');
const runtime = read('projection/build/deck-runtime.js');
const fontB64 = readFileSync(path.join(ROOT, 'assets/fonts/PretendardVariable.woff2')).toString('base64');

// ───────────────────────── Utilidades de diapositivas ─────────────────────────
const slides = [];
function slide({ id, grad, cls = '', title, notes, round = null, phase = null, phaseLabel = '', duration = 0, timerGroup = null, turns = 0, turnSeconds = 0, turnNames = [], body }) {
  const attrs = [
    `class="slide slide-grad-${grad}${cls ? ' ' + cls : ''}"`,
    `id="${id}"`,
    `data-title="${esc(title)}"`,
    round ? `data-round="${round}"` : '',
    phase ? `data-phase="${phase}"` : '',
    phaseLabel ? `data-phase-label="${esc(phaseLabel)}"` : '',
    duration ? `data-duration="${duration}"` : '',
    timerGroup ? `data-timer-group="${timerGroup}"` : '',
    turns ? `data-turns="${turns}" data-turn-seconds="${turnSeconds}"` : '',
    turnNames.length ? `data-turn-names="${esc(turnNames.join('|'))}"` : '',
    `data-notes="${esc(notes)}"`,
  ].filter(Boolean);
  slides.push({ id, round, phase, title, html: `<div ${attrs.join(' ')}>\n${body}\n</div>` });
}

const TEAM_STYLE = {
  azul: { color: '#60a5fa', shape: '<circle cx="16" cy="16" r="12"/>' },
  rojo: { color: '#f87171', shape: '<rect x="5" y="5" width="22" height="22" rx="3"/>' },
  verde: { color: '#4ade80', shape: '<path d="M16 3 L29 27 H3 Z"/>' },
  amarillo: { color: '#fbbf24', shape: '<path d="M16 2 L30 16 L16 30 L2 16 Z"/>' },
  morado: { color: '#c084fc', shape: '<path d="M16 2 L20 12 L31 12.5 L22.5 19.5 L25.5 30 L16 24 L6.5 30 L9.5 19.5 L1 12.5 L12 12 Z"/>' },
};
const teamShape = (id) =>
  `<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="${TEAM_STYLE[id].color}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round">${TEAM_STYLE[id].shape}</g></svg>`;
const teamChip = (t) => `<span class="team">${teamShape(t.id)}<span>${esc(t.name)}</span></span>`;

const evidenceSvg = (id) => read(`assets/evidence/${id}.svg`).trim();
const evById = Object.fromEntries(EVIDENCE.map((e) => [e.id, e]));
const PHONE_KINDS = new Set(['phone-chat', 'group-info', 'lumen-profile', 'lumen-post', 'platform-notice']);
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const ROUND_TIMES = [
  ['Revelación', 60], ['Deliberación', 120], ['Defensa', 150], ['Objeciones', 45], ['Confrontación', 180], ['Resultados', 45],
];
const FINAL_TIMES = [
  ['Análisis', 90], ['Alegatos', 120], ['Objeciones', 45], ['Confrontación', 180], ['Resultados', 45],
];
const GRADS = { R1: 2, R2: 3, R3: 10, R4: 8, FINAL: 9 };

function rotation(n) {
  return TEAMS.map((_, i) => TEAMS[(i + n) % TEAMS.length].name.replace('Equipo ', ''));
}

// ───────────────────────── APERTURA (7:00) ─────────────────────────
slide({
  id: 'portada', grad: 1, cls: 'title-slide', title: 'Portada',
  notes: '[Apertura · 0:00–0:30] Bienvenida. Taller de 60 minutos: cinco equipos de cuatro investigan un caso ficticio que avanza en cuatro rondas y termina en un veredicto. No es una clase: ellos investigan, deciden y se objetan. Teclas: F pantalla completa, S notas (esta ventana), ← → para moverse, T inicia o pausa el reloj, N pasa de turno, R reinicia el reloj.',
  body: `<span class="a tag">Taller · 60 minutos · 5 equipos</span>
<h1 class="a xl text-center">Tribunal Digital</h1>
<p class="a subtitle">Caso: «${esc(CASE_INFO.title)}»</p>
<p class="a date-text">Investigar · argumentar · proteger</p>`,
});

slide({
  id: 'aviso', grad: 4, cls: 'layout-wide', title: 'Antes de empezar',
  notes: '[0:30–1:30] Encuadre de cuidado. Lea los cuatro puntos. Si alguien necesita salir o hablar en privado, facilítelo sin pedir explicaciones. Remarque la frase final: guiará todo el juego. No adelante nada del contenido del caso.',
  body: `<div class="content-body" style="max-width:1200px">
<span class="a kicker">Antes de empezar</span>
<h2 class="a lg" style="margin-top:22px">Un caso ficticio, un tema real</h2>
<ul class="a">
<li class="a" style="font-size:25px">Todo es inventado: personas, cuentas, marcas, sitios y dominios.</li>
<li class="a" style="font-size:25px">El caso trata sobre <span class="highlight">posibles riesgos para un menor en internet</span>. No contiene material sexual explícito.</li>
<li class="a" style="font-size:25px">Si el tema te toca de cerca, puedes salir un momento o hablar en privado con la organización.</li>
<li class="a" style="font-size:25px">Se discuten argumentos, no personas. Nadie en esta sala es sospechoso de nada.</li>
</ul>
<p class="a md mt-3"><span class="accent">Sospechar no es probar.</span> Proteger no es acusar.</p>
</div>`,
});

slide({
  id: 'mision', grad: 7, title: 'Su misión',
  notes: '[1:30–2:30] Una sola respuesta colectiva por equipo y fase: una afirmación, una o dos evidencias y una acción. No hay voto individual: todas las personas pueden aportar durante la deliberación. Las respuestas se bloquean en la aplicación y, ya bloqueadas, se proyectan para que todos puedan objetarlas.',
  body: `<span class="a kicker">Su misión</span>
<h2 class="a lg text-center" style="margin-top:20px">Cada fase, una respuesta por equipo</h2>
<div class="a cards-grid wide">
<div class="a glass-card"><span class="card-icon">🧩</span><h3>1 afirmación</h3><p class="big">Qué se puede afirmar con lo que hay. Varias suenan bien y no todas se sostienen.</p><span class="card-tag">Afirmar</span></div>
<div class="a glass-card"><span class="card-icon">🔎</span><h3>1–2 evidencias</h3><p class="big">Las que sostienen cada dato de su afirmación. Las de rondas anteriores siguen disponibles.</p><span class="card-tag">Citar</span></div>
<div class="a glass-card"><span class="card-icon">🛡️</span><h3>1 acción</h3><p class="big">Qué deberían hacer Leo o su familia ahora, con lo que se sabe en este momento.</p><span class="card-tag">Decidir</span></div>
</div>
<p class="a lead text-center mt-2">Todo el equipo delibera. La respuesta se bloquea en la app y después se ve en pantalla.</p>`,
});

slide({
  id: 'puntos', grad: 8, title: 'Cómo se puntúa',
  notes: '[2:30–3:30] +3 si la afirmación queda sostenida por un conjunto de evidencias aceptado (las evidencias deben cubrir cada dato de la afirmación); +2 si la acción es protectora; +3 por cada objeción válida; 0 por una jugada inválida, y la ficha de una objeción fallida se pierde igual. Desempate: más objeciones válidas; luego más argumentos sostenidos; si persiste, victoria compartida. Los discursos no suman: todo lo decide una clave fija, preparada antes del juego.',
  body: `<span class="a kicker">Puntuación</span>
<h2 class="a lg text-center" style="margin-top:18px">Cómo se puntúa</h2>
<div class="a chart-container" style="max-width:1000px;height:330px">
<div class="chart-bar-group"><div class="chart-bar bar-color-1" style="height:90%;max-width:120px"><span class="bar-val" style="font-size:26px;top:-38px">+3</span></div><span class="bar-label" style="font-size:20px;color:#fff">Argumento sostenido</span></div>
<div class="chart-bar-group"><div class="chart-bar bar-color-2" style="height:60%;max-width:120px"><span class="bar-val" style="font-size:26px;top:-38px">+2</span></div><span class="bar-label" style="font-size:20px;color:#fff">Acción protectora</span></div>
<div class="chart-bar-group"><div class="chart-bar bar-color-4" style="height:90%;max-width:120px"><span class="bar-val" style="font-size:26px;top:-38px">+3</span></div><span class="bar-label" style="font-size:20px;color:#fff">Objeción válida</span></div>
<div class="chart-bar-group"><div class="chart-bar bar-color-5" style="height:3%;max-width:120px"><span class="bar-val" style="font-size:26px;top:-38px">0</span></div><span class="bar-label" style="font-size:20px;color:#fff;text-align:center;white-space:normal">Jugada inválida<br><small style="font-size:15px;color:var(--text-secondary)">(la ficha se gasta igual)</small></span></div>
</div>
<div class="a glass-dark" style="padding:18px 28px;margin-top:22px;max-width:1240px">
<p style="font-size:21px;line-height:1.55"><b class="accent">Desempate:</b> 1) más objeciones válidas · 2) más argumentos sostenidos · 3) victoria compartida.<br><b class="accent">Los discursos no suman:</b> decide una clave fija. Para el +3, las evidencias deben cubrir cada dato de la afirmación.</p>
</div>`,
});

slide({
  id: 'objeciones', grad: 4, cls: 'layout-wide', title: 'Objeciones',
  notes: '[3:30–4:45] Cada equipo tiene 3 fichas para todo el juego y puede gastar como máximo una por fase. Si la objeción falla, la ficha se pierde. Cada objeción indica: equipo objetivo, categoría y UNA evidencia citada. Recorra las cuatro categorías con sus pruebas. Si varias categorías aplican, cualquiera vale. Contra una respuesta correcta, cualquier objeción falla. La defensa verbal es libre, pero no cambia el resultado: lo decide la clave.',
  body: `<div class="head-row a"><div><span class="kicker">Objeciones</span><h2 class="lg" style="margin-top:14px">3 fichas para todo el juego</h2></div></div>
<p class="a lead" style="margin-top:10px">Máximo una por fase · se gasta aunque falle · indiquen <b class="accent">equipo objetivo, categoría y UNA evidencia</b></p>
<div class="a decide-grid">
<div class="flow-step"><div class="step-glow"></div><div class="step-num">Contradicción</div><div class="step-title">Un dato es falso</div><div class="step-desc">Algún dato de la afirmación choca con lo que muestra una evidencia.</div><div class="step-cite">Cita: la evidencia que lo contradice</div></div>
<div class="flow-step"><div class="step-glow"></div><div class="step-num">Certeza injustificada</div><div class="step-title">Da por seguro lo que no lo es</div><div class="step-desc">Identidad, intención, culpa, «imposible», «demostrado»… sin que la evidencia lo establezca.</div><div class="step-cite">Cita: la que lo deja abierto o lo desmiente, o una de las suyas</div></div>
<div class="flow-step"><div class="step-glow"></div><div class="step-num">Salto lógico</div><div class="step-title">No alcanza</div><div class="step-desc">La afirmación no es falsa, pero las evidencias que citaron no bastan para sostenerla.</div><div class="step-cite">Cita: una de sus evidencias o la que falta</div></div>
<div class="flow-step"><div class="step-glow"></div><div class="step-num">Acción insegura</div><div class="step-title">Expone o destruye</div><div class="step-desc">La acción expone a alguien, alerta al sospechoso o destruye pruebas.</div><div class="step-cite">Cita: la evidencia que muestra ese riesgo</div></div>
</div>
<p class="a lock-hint" style="margin-top:24px">Si aplican varias categorías, <b>cualquiera vale</b>. Contra una respuesta correcta, <b>toda objeción falla</b>.</p>`,
});

slide({
  id: 'ronda-tipo', grad: 7, cls: 'layout-wide', title: 'Así es cada ronda',
  notes: '[4:45–5:30] Ritmo de cada ronda (10 minutos). La final cambia: 1:30 de análisis, alegatos de 24 s, y el resto igual. El portavoz rota: en cada ronda habla una persona distinta de cada equipo. Use T para iniciar o pausar el reloj, N para pasar al siguiente turno y R para reiniciar.',
  body: `<div class="a"><span class="kicker">Ritmo</span><h2 class="lg" style="margin-top:14px">Así es cada ronda · 10 minutos</h2></div>
<div class="a timeline">
<div class="seg glass-dark" style="flex:1"><span class="dur">1:00</span><span class="name">Revelación</span><span class="desc">Nuevas evidencias en pantalla y en la app.</span></div>
<div class="seg glass-dark" style="flex:1.3"><span class="dur">2:00</span><span class="name">Deliberación</span><span class="desc">Afirmación + 1–2 evidencias + acción. Se bloquea.</span></div>
<div class="seg glass-dark" style="flex:1.4"><span class="dur">2:30</span><span class="name">Defensa</span><span class="desc">5 portavoces × 30 s. Portavoz distinto cada ronda.</span></div>
<div class="seg glass-dark" style="flex:1"><span class="dur">0:45</span><span class="name">Objeciones</span><span class="desc">¿Gastan una ficha? Objetivo, categoría, evidencia.</span></div>
<div class="seg glass-dark" style="flex:1.5"><span class="dur">3:00</span><span class="name">Confrontación</span><span class="desc">Hasta 5 intercambios: ataque 18 s · defensa 18 s.</span></div>
<div class="seg glass-dark" style="flex:1"><span class="dur">0:45</span><span class="name">Resultados</span><span class="desc">Marcador y cierre de ronda.</span></div>
</div>
<p class="a lead" style="margin-top:28px">Final: <b class="accent">1:30</b> análisis · <b class="accent">2:00</b> alegatos (5 × 24 s) · <b class="accent">0:45</b> objeciones · <b class="accent">3:00</b> confrontación · <b class="accent">0:45</b> resultados</p>`,
});

slide({
  id: 'practica', grad: 1, cls: 'layout-wide', title: 'Práctica',
  notes: '[5:30–6:30] Ejemplo ajeno al caso. 1) Verde afirma algo que P2 desmiente: la contradicción de Rojo citando P2 es válida (+3 para Rojo). Pregunte qué otra objeción habría servido contra Verde: acción insegura, porque enviar la dirección expone a quien juega (citando P1). 2) Morado ya fue prudente: la certeza injustificada de Azul falla y Azul pierde su ficha. Moraleja: objetar cuesta; hay que leer la respuesta y las evidencias.',
  body: `<div class="a"><span class="kicker">Práctica · fuera del caso</span><h2 class="lg" style="margin-top:14px">Cómo se resuelve una objeción</h2></div>
<div class="a practice">
<div class="glass-dark"><h4>Evidencias de práctica</h4>
<p><span class="chip sm">P1</span> Mensaje de <b>@premios.lumen.oficial</b>: «¡Ganaste un móvil! Mándame tu dirección y tu teléfono para el envío».</p>
<p><span class="chip sm">P2</span> Perfil de <b>@premios.lumen.oficial</b>: creado ayer · 0 publicaciones · sin verificación.</p></div>
<div class="glass-dark"><h4>Respuesta del Equipo Verde</h4>
<p>«La cuenta lleva años sorteando premios en Lumen» · <span class="chip sm ghost">P1</span> · Acción: enviar la dirección.</p>
<h4 style="margin-top:8px">Objeción del Equipo Rojo</h4>
<p>Contradicción · cita <span class="chip sm ghost">P2</span></p>
<p class="verdict ok">✓ Válida: P2 muestra que la cuenta se creó ayer. +3 para Rojo.</p></div>
<div class="glass-dark"><h4>Respuesta del Equipo Morado</h4>
<p>«La cuenta es nueva y pide datos: conviene verificar el sorteo por un canal oficial» · <span class="chip sm ghost">P1</span> <span class="chip sm ghost">P2</span></p>
<h4 style="margin-top:8px">Objeción del Equipo Azul</h4>
<p>Certeza injustificada · cita <span class="chip sm ghost">P2</span></p>
<p class="verdict ko">✗ Falla: Morado no da nada por seguro. Azul pierde la ficha.</p></div>
</div>`,
});

slide({
  id: 'caso', grad: 4, title: 'El caso',
  notes: '[6:30–6:50] Presente el caso con la cita de Marina. Léala con calma, sin dramatizar. No añada información.',
  body: `<div class="a quote-block">
<div class="a quote-mark">&ldquo;</div>
<p class="a quote-text" style="font-size:40px">Mi hermano Leo tiene 14 años y le ofrecieron un «pase directo» para un torneo de su videojuego. Algo no me cierra. ¿Me ayudan a pensar qué podemos afirmar y qué deberíamos hacer?</p>
<p class="a quote-attr">&mdash; <span>Marina Márquez</span>, 20 años</p>
</div>`,
});

slide({
  id: 'personajes', grad: 7, cls: 'layout-wide', title: 'Personajes y glosario',
  notes: '[6:50–7:00] Repase personajes y glosario sin interpretar nada. Pida que cada equipo elija portavoz para la Ronda 1 y recuerde que debe rotar en cada ronda.',
  body: `<div class="a"><span class="kicker">Expediente</span><h2 class="lg" style="margin-top:12px">Personajes y glosario</h2></div>
<div class="a cards-grid cols-4" style="margin-top:20px;gap:16px">
${CHARACTERS.map((c) => `<div class="glass-card" style="padding:20px 20px"><h3 style="font-size:22px">${esc(c.name)}</h3><p class="big" style="font-size:17.5px">${esc(c.role)}</p></div>`).join('\n')}
</div>
<div class="a cards-grid cols-4" style="margin-top:16px;gap:16px">
${GLOSSARY.map((g) => `<div class="glass-dark" style="padding:18px 20px"><h3 style="font-size:20px;color:var(--accent);margin-bottom:6px">${esc(g.term)}</h3><p style="font-size:17px;line-height:1.5;color:var(--text-secondary)">${esc(g.text)}</p></div>`).join('\n')}
</div>
<p class="a src-note" style="font-size:16px">${esc(CASE_INFO.provenance)} ${esc(CASE_INFO.disclaimer)}</p>`,
});

// ───────────────────────── RONDAS ─────────────────────────
const released = [];

function optionsSlide({ r, id, grad, title, notes, phase, phaseLabel, duration, timerGroup }) {
  const avail = [...released];
  const isNew = (e) => evById[e].round === r.id;
  const dense = Math.max(...r.claims.map((c) => c.length)) > 150 ? ' dense' : '';
  slide({
    id, grad, cls: 'layout-wide', title, notes, round: r.id, phase, phaseLabel, duration, timerGroup,
    body: `<div class="a"><span class="kicker">${r.id === 'FINAL' ? 'Final' : 'Ronda ' + r.number}<span class="sep">·</span>${esc(phaseLabel)}</span>
<h2 class="question" style="margin-top:14px;max-width:1180px">${esc(r.question)}</h2></div>
<div class="a opts${dense}">
<div><h3>Afirmaciones</h3><div class="opt-list">
${r.claims.map((c, i) => `<div class="opt glass-dark"><span class="chip">C${i + 1}</span><p>${esc(c)}</p></div>`).join('\n')}
</div></div>
<div><h3>Acciones</h3><div class="opt-list">
${r.actions.map((a, i) => `<div class="opt glass-dark"><span class="chip">A${i + 1}</span><p>${esc(a)}</p></div>`).join('\n')}
</div></div>
</div>
<div class="a ev-avail"><span>Evidencias disponibles:</span>${avail.map((e) => `<span class="chip sm${isNew(e) ? '' : ' ghost'}">${e}</span>`).join('')}<span style="margin-left:auto" class="lock-hint">Bloqueen: <b>1 afirmación · 1–2 evidencias · 1 acción</b></span></div>`,
  });
}

function evidenceSlide({ e, r, idx, total, grad, timerGroup, phase, phaseLabel, duration, notesPrefix }) {
  const phone = PHONE_KINDS.has(e.kind);
  slide({
    id: `${r.id === 'FINAL' ? 'final' : r.id.toLowerCase()}-${e.id.toLowerCase()}`,
    grad, cls: 'ev-slide', title: `Evidencia ${e.id}`, round: r.id, phase, phaseLabel, duration, timerGroup,
    notes: `${notesPrefix} Evidencia ${e.id} (${idx}/${total}). Lea en voz alta solo el encabezado: «${e.label}», ${e.when.charAt(0).toLowerCase() + e.when.slice(1)}. No señale detalles ni interprete: esa es la tarea de los equipos. La transcripción completa está en la app y en el texto alternativo de la imagen.`,
    body: `<div class="ev-grid${phone ? ' phone' : ''}">
<div class="ev-info a">
<span class="kicker">${r.id === 'FINAL' ? 'Final' : 'Ronda ' + r.number}<span class="sep">·</span>Evidencia ${idx}/${total}</span>
<div class="ev-id">${e.id}</div>
<div class="ev-label">${esc(e.label)}</div>
<div class="ev-meta"><b>Fuente</b>${esc(e.source)}</div>
<div class="ev-meta"><b>Fecha</b>${esc(e.when)}</div>
</div>
<div class="ev-figure a">${evidenceSvg(e.id)}</div>
</div>`,
  });
}

function liveSlides({ r, prefix, grad, defenseName, defenseSecs, defenseTotal, notes }) {
  const label = r.id === 'FINAL' ? 'Final' : `Ronda ${r.number}`;
  const order = rotation(r.number - 1);
  slide({
    id: `${prefix}-${defenseName === 'Alegatos' ? 'alegatos' : 'defensa'}`, grad: 7, cls: 'layout-wide', title: `${label} · ${defenseName}`,
    round: r.id, phase: 'defense', phaseLabel: defenseName, duration: defenseTotal, turns: 5, turnSeconds: defenseSecs, turnNames: order,
    notes: notes.defense,
    body: `<div class="a head-row"><div><span class="kicker">${label}<span class="sep">·</span>${defenseName}</span>
<h2 class="lg" style="margin-top:12px">Respuestas bloqueadas</h2></div>
<p class="lock-hint" style="text-align:right">${defenseSecs} s por equipo · portavoz distinto cada ronda<br>Orden: <b>${order.join(' → ')}</b></p></div>
<div class="a resp" data-live="responses" data-round="${r.id}"></div>`,
  });
  slide({
    id: `${prefix}-objeciones`, grad: 8, cls: 'layout-wide', title: `${label} · Objeciones`,
    round: r.id, phase: 'objection', phaseLabel: 'Objeciones', duration: 45, notes: notes.objection,
    body: `<div class="a"><span class="kicker">${label}<span class="sep">·</span>Objeciones</span>
<h2 class="lg" style="margin-top:12px">¿Gastan una ficha?</h2></div>
<p class="a lead" style="margin-top:6px">En la app: <b class="accent">equipo objetivo · categoría · una evidencia</b>. Máximo una por fase; si falla, se pierde.</p>
<div class="a token-strip" data-live="tokens" data-round="${r.id}"></div>
<div class="a cards-grid cols-4" style="margin-top:22px;gap:14px">
<div class="glass-dark" style="padding:16px 18px"><h3 style="font-size:19px;color:var(--accent)">Contradicción</h3><p style="font-size:16.5px;line-height:1.45">Un dato es falso según una evidencia.</p></div>
<div class="glass-dark" style="padding:16px 18px"><h3 style="font-size:19px;color:var(--accent)">Certeza injustificada</h3><p style="font-size:16.5px;line-height:1.45">Da por seguro algo que la evidencia no establece.</p></div>
<div class="glass-dark" style="padding:16px 18px"><h3 style="font-size:19px;color:var(--accent)">Salto lógico</h3><p style="font-size:16.5px;line-height:1.45">No es falsa, pero sus evidencias no alcanzan.</p></div>
<div class="glass-dark" style="padding:16px 18px"><h3 style="font-size:19px;color:var(--accent)">Acción insegura</h3><p style="font-size:16.5px;line-height:1.45">Expone a alguien, alerta o destruye pruebas.</p></div>
</div>`,
  });
  slide({
    id: `${prefix}-confrontacion`, grad: 1, cls: 'layout-wide', title: `${label} · Confrontación`,
    round: r.id, phase: 'confrontation', phaseLabel: 'Confrontación', duration: 180, turns: 10, turnSeconds: 18,
    turnNames: Array.from({ length: 10 }, (_, i) => `${i % 2 ? 'Defensa' : 'Ataque'} ${Math.floor(i / 2) + 1}`),
    notes: notes.confrontation,
    body: `<div class="a"><span class="kicker">${label}<span class="sep">·</span>Confrontación</span>
<h2 class="lg" style="margin-top:12px">Hasta 5 intercambios</h2></div>
<div class="a flow-container" style="max-width:1100px;margin-top:34px">
<div class="flow-step"><div class="step-glow"></div><div class="step-num">18 s</div><div class="step-title" style="font-size:26px">Ataque</div><div class="step-desc" style="font-size:18px">El equipo que objetó explica su categoría y la evidencia citada.</div></div>
<div class="flow-arrow">&rarr;</div>
<div class="flow-step"><div class="step-glow"></div><div class="step-num">18 s</div><div class="step-title" style="font-size:26px">Defensa</div><div class="step-desc" style="font-size:18px">El equipo objetado responde. La defensa verbal es libre.</div></div>
<div class="flow-arrow">&rarr;</div>
<div class="flow-step"><div class="step-glow"></div><div class="step-num">× 5</div><div class="step-title" style="font-size:26px">Siguiente</div><div class="step-desc" style="font-size:18px">Si hubo más de cinco objeciones, se debaten las cinco primeras.</div></div>
</div>
<div class="a glass-dark" style="padding:18px 26px;margin-top:34px;max-width:1100px"><p style="font-size:22px;line-height:1.5">Se discuten <b class="accent">argumentos, no personas</b>. El resultado no depende del aplauso ni de la oratoria: lo decide la clave.</p></div>`,
  });
  slide({
    id: `${prefix}-resultados`, grad: 11, cls: 'layout-wide', title: `${label} · Resultados`,
    round: r.id, phase: 'resolution', phaseLabel: 'Resultados', duration: 45, notes: notes.resolution,
    body: `<div class="a"><span class="kicker">${label}<span class="sep">·</span>Resultados</span>
<h2 class="lg" style="margin-top:12px">Marcador</h2></div>
<div class="a board" data-live="scoreboard" data-round="${r.id}"></div>`,
  });
}

const genericNotes = (label, defenseSecs) => ({
  defense: `[${label} · ${defenseSecs === 30 ? 'Defensa · 2:30' : 'Alegatos · 2:00'}] Las respuestas ya están bloqueadas y se ven en pantalla. Cada portavoz tiene ${defenseSecs} s: pulse T para el reloj general y N para pasar de turno (el orden rota en cada ronda). La defensa verbal es libre y no suma puntos. Si una respuesta no aparece, ese equipo no bloqueó a tiempo.`,
  objection: `[${label} · Objeciones · 0:45] Cada equipo decide si gasta una ficha (máximo una por fase). En la app indica equipo objetivo, categoría y una sola evidencia. Recuerde: una objeción fallida también gasta la ficha. Usted no conoce el resultado en pantalla; lo calcula la aplicación con la clave privada.`,
  confrontation: `[${label} · Confrontación · 3:00] Hasta cinco intercambios de 18 s: primero ataca el equipo que objetó, luego responde el objetado. Use N para alternar turnos. Modere el tono: argumentos, no personas. No anticipe si la objeción es válida.`,
  resolution: `[${label} · Resultados · 0:45] Muestre el marcador. Explique en 30 s la lógica de la ronda con su hoja privada de fundamentos (rationales.private.md, fuera de esta presentación). Anuncie el cambio de portavoz para la siguiente fase.`,
});

for (const r of ROUNDS) {
  const evs = EVIDENCE.filter((e) => e.round === r.id);
  released.push(...evs.map((e) => e.id));
  const grad = GRADS[r.id];
  if (r.id !== 'FINAL') {
    const pre = r.id.toLowerCase();
    const group = `${pre}-reveal`;
    slide({
      id: `${pre}-revelacion`, grad, cls: 'round-divider', title: `Ronda ${r.number} · ${r.name}`,
      round: r.id, phase: 'reveal', phaseLabel: 'Revelación', duration: 60, timerGroup: group,
      notes: `[Ronda ${r.number} · Revelación · 1:00] Pulse T. Lea la pregunta de la ronda y recorra las ${evs.length} evidencias nuevas (unos 15 s cada una). Quedan disponibles en la app para todos los equipos y siguen disponibles en las rondas siguientes. No interprete ni subraye nada.`,
      body: `<span class="a kicker">Ronda ${r.number}<span class="sep">·</span>Revelación</span>
<div class="a big-num">0${r.number}</div>
<h2 class="a xl text-center">${esc(r.name)}</h2>
<p class="a question">${esc(r.question)}</p>
<div class="a phase-strip">${ROUND_TIMES.map(([n, t]) => `<span><b>${fmt(t)}</b>${n}</span>`).join('')}</div>`,
    });
    evs.forEach((e, i) => evidenceSlide({ e, r, idx: i + 1, total: evs.length, grad: 9, timerGroup: group, phase: 'reveal', phaseLabel: 'Revelación', duration: 60, notesPrefix: `[Ronda ${r.number} · Revelación]` }));
    optionsSlide({
      r, id: `${pre}-deliberacion`, grad: 4, title: `Ronda ${r.number} · Deliberación`, phase: 'deliberation', phaseLabel: 'Deliberación', duration: 120,
      notes: `[Ronda ${r.number} · Deliberación · 2:00] Pulse T. Cada equipo bloquea en la app una afirmación, una o dos evidencias y una acción. Avise cuando queden 30 s. Si piden volver a una evidencia, use ← y regrese aquí. Sin bloqueo a tiempo no hay puntos en esta fase. No responda preguntas sobre qué opción es mejor.`,
    });
    liveSlides({ r, prefix: pre, grad, defenseName: 'Defensa', defenseSecs: 30, defenseTotal: 150, notes: genericNotes(`Ronda ${r.number}`, 30) });
  } else {
    const group = 'final-analysis';
    slide({
      id: 'final-revelacion', grad, cls: 'layout-wide', title: 'Final · Veredicto',
      round: r.id, phase: 'deliberation', phaseLabel: 'Análisis', duration: 90, timerGroup: group,
      notes: '[Final · Análisis · 1:30] Pulse T: el reloj de 1:30 cubre estas diapositivas y la de opciones. Presente las dos evidencias nuevas leyendo solo su encabezado; luego avance a la diapositiva de afirmaciones y acciones. Los equipos analizan y bloquean dentro de este mismo tiempo.',
      body: `<div class="a"><span class="kicker">Final<span class="sep">·</span>Análisis</span>
<h2 class="lg" style="margin-top:12px">Veredicto: dos evidencias nuevas</h2>
<p class="question" style="margin-top:8px;font-size:26px">${esc(r.question)}</p></div>
<div class="a ev-pair">
${evs.map((e) => `<figure><figcaption><span class="chip sm">${e.id}</span>${esc(e.label)}</figcaption><div class="fig">${evidenceSvg(e.id).replace(/id="(E\d\d)-/g, 'id="pair-$1-').replace(/aria-labelledby="(E\d\d)-title (E\d\d)-desc"/, 'aria-labelledby="pair-$1-title pair-$2-desc"').replace(/url\(#(E\d\d)-/g, 'url(#pair-$1-')}</div></figure>`).join('\n')}
</div>`,
    });
    evs.forEach((e, i) => evidenceSlide({ e, r, idx: i + 1, total: evs.length, grad: 9, timerGroup: group, phase: 'deliberation', phaseLabel: 'Análisis', duration: 90, notesPrefix: '[Final · Análisis]' }));
    optionsSlide({
      r, id: 'final-deliberacion', grad: 4, title: 'Final · Afirmaciones y acciones', phase: 'deliberation', phaseLabel: 'Análisis', duration: 90, timerGroup: group,
      notes: '[Final · Análisis] Mismo reloj de 1:30. Cada equipo bloquea su veredicto: una afirmación, una o dos evidencias (de todo el expediente) y una acción. Avise a los 30 s finales.',
    });
    liveSlides({ r, prefix: 'final', grad, defenseName: 'Alegatos', defenseSecs: 24, defenseTotal: 120, notes: genericNotes('Final', 24) });
  }
}

// ───────────────────────── CIERRE (5:00) ─────────────────────────
slide({
  id: 'cierre-podio', grad: 11, cls: 'layout-wide', title: 'Cierre · Resultado final',
  phaseLabel: 'Cierre', duration: 300, timerGroup: 'cierre',
  notes: '[Cierre · 0:00–1:00] Pulse T (5:00 para todo el cierre). Anuncie el resultado. Desempates: 1) más objeciones válidas; 2) más argumentos sostenidos; 3) si sigue el empate, victoria compartida. Felicite el razonamiento, no solo el resultado.',
  body: `<div class="a"><span class="kicker">Cierre</span>
<h2 class="lg" style="margin-top:12px">Veredicto del Tribunal</h2></div>
<div class="a board" data-live="scoreboard"></div>
<p class="a lock-hint" style="margin-top:14px">Desempate: <b>1)</b> más objeciones válidas · <b>2)</b> más argumentos sostenidos · <b>3)</b> victoria compartida</p>`,
});

slide({
  id: 'cierre-senales', grad: 7, cls: 'layout-wide', title: 'Cierre · Señales que importan',
  phaseLabel: 'Cierre', duration: 300, timerGroup: 'cierre',
  notes: '[1:00–2:30] Organizaciones de protección de la infancia describen la captación (grooming) como un proceso gradual: ganar confianza, aislar, pedir secreto y escalar. Ninguna señal sola prueba nada; importan porque juntas forman un patrón que se repite. Las fuentes, con enlace y fecha de consulta, están en content/README.md.',
  body: `<div class="a"><span class="kicker">Lo que aprendimos</span><h2 class="lg" style="margin-top:12px">Señales que importan, y por qué</h2></div>
<div class="a cards-grid" style="max-width:none;margin-top:22px;gap:18px">
<div class="glass-card" style="padding:24px"><span class="card-icon">🎭</span><h3>Una figura atractiva</h3><p class="big">Un «entrenador», un «cazatalentos» o un premio abren la puerta. Que la oferta exista no prueba quién escribe.</p></div>
<div class="glass-card" style="padding:24px"><span class="card-icon">🤫</span><h3>Secreto frente a la familia</h3><p class="big">No es lo mismo guardar una jugada que ocultar un contacto a los adultos que cuidan.</p></div>
<div class="glass-card" style="padding:24px"><span class="card-icon">🔒</span><h3>Canal privado que se borra</h3><p class="big">Pasar a un chat aparte, sin moderación y con mensajes temporales, deja al menor solo y sin pruebas.</p></div>
<div class="glass-card" style="padding:24px"><span class="card-icon">🎁</span><h3>Regalos y favores</h3><p class="big">Crean deuda y complicidad: «que quede entre nosotros».</p></div>
<div class="glass-card" style="padding:24px"><span class="card-icon">📸</span><h3>Fotos, datos y «a solas»</h3><p class="big">Pedir imágenes, el colegio o una videollamada sin nadie cerca aumenta la exposición.</p></div>
<div class="glass-card" style="padding:24px"><span class="card-icon">🚗</span><h3>Encuentro sin adultos</h3><p class="big">Ofrecer recoger al menor fuera de los canales oficiales es una señal de riesgo clara.</p></div>
</div>`,
});

slide({
  id: 'cierre-limites', grad: 4, title: 'Cierre · Señal no es prueba',
  phaseLabel: 'Cierre', duration: 300, timerGroup: 'cierre',
  notes: '[2:30–3:30] Las señales justifican proteger, verificar y denunciar; no justifican declarar culpable a nadie. La identidad y la intención las establece una investigación. Para denunciar no hace falta estar seguro: las líneas de ayuda evalúan cada caso. Acusar en público puede dañar a inocentes (incluso a la persona suplantada) y alertar a quien está detrás.',
  body: `<span class="a kicker">Calibrar</span>
<h2 class="a lg text-center" style="margin-top:14px">Señal no es prueba, y no hace falta prueba para pedir ayuda</h2>
<div class="a compare-grid" style="max-width:1240px;margin-top:30px">
<div class="compare-col col-before glass-dark"><h3 style="color:#fff">Lo que las señales NO prueban</h3><ul>
<li style="font-size:20px">Quién está detrás de una cuenta.</li>
<li style="font-size:20px">Qué intención tiene, ni qué delito cometió.</li>
<li style="font-size:20px">Que haya otras víctimas.</li>
<li style="font-size:20px">Que la persona cuyo nombre o foto se usan sea culpable.</li></ul></div>
<div class="compare-col col-after"><h3>Lo que SÍ justifican</h3><ul>
<li style="font-size:20px">Verificar por canales oficiales y no compartir datos.</li>
<li style="font-size:20px">Contarlo a un adulto de confianza.</li>
<li style="font-size:20px">Guardar pruebas y denunciar cuando el riesgo es claro.</li>
<li style="font-size:20px">Dejar la investigación a quien puede hacerla.</li></ul></div>
</div>`,
});

slide({
  id: 'cierre-acciones', grad: 3, title: 'Cierre · Qué hacer',
  phaseLabel: 'Cierre', duration: 300, timerGroup: 'cierre',
  notes: '[3:30–4:15] Cuatro gestos simples. Matices: guardar pruebas ANTES de bloquear o borrar; no confrontar ni «jugar al detective»; nunca reenviar ni guardar imágenes íntimas de menores, ni siquiera como prueba: se denuncian sin copiarlas.',
  body: `<span class="a kicker">Qué hacer</span>
<h2 class="a lg text-center" style="margin-top:14px">Cuatro gestos que protegen</h2>
<div class="a flow-container" style="max-width:1300px;margin-top:34px">
<div class="flow-step glass-dark"><div class="step-glow"></div><div class="step-num">1</div><div class="step-title" style="font-size:24px">Verificar</div><div class="step-desc" style="font-size:17px;color:#fff">Por el canal oficial, no preguntando a la cuenta sospechosa.</div></div>
<div class="flow-arrow">&rarr;</div>
<div class="flow-step glass-dark"><div class="step-glow"></div><div class="step-num">2</div><div class="step-title" style="font-size:24px">No compartir</div><div class="step-desc" style="font-size:17px;color:#fff">Ni datos, ni fotos, ni ubicación, ni el colegio.</div></div>
<div class="flow-arrow">&rarr;</div>
<div class="flow-step glass-dark"><div class="step-glow"></div><div class="step-num">3</div><div class="step-title" style="font-size:24px">Contar</div><div class="step-desc" style="font-size:17px;color:#fff">A un adulto de confianza, sin miedo a castigos.</div></div>
<div class="flow-arrow">&rarr;</div>
<div class="flow-step glass-dark"><div class="step-glow"></div><div class="step-num">4</div><div class="step-title" style="font-size:24px">Guardar y denunciar</div><div class="step-desc" style="font-size:17px;color:#fff">Capturas antes de bloquear; reporte a la plataforma y a las autoridades.</div></div>
</div>`,
});

slide({
  id: 'cierre-recursos', grad: 4, cls: 'layout-wide', title: 'Cierre · Dónde pedir ayuda',
  phaseLabel: 'Cierre', duration: 300, timerGroup: 'cierre',
  notes: '[4:15–4:45] Muestre los recursos del país de la sala. Los números se tomaron de páginas oficiales indexadas el 13 de octubre de 2026 (detalle en content/README.md). Antes del taller, confirme el recurso local que corresponda y añádalo si falta.',
  body: `<div class="a"><span class="kicker">Recursos</span><h2 class="lg" style="margin-top:12px">Dónde pedir ayuda o denunciar</h2></div>
<div class="a res-grid">
<div class="glass-dark"><h4>España</h4><p><b>017</b> · Tu Ayuda en Ciberseguridad (INCIBE)<br><b>900 20 20 10</b> y <b>116 111</b> · Fundación ANAR</p></div>
<div class="glass-dark"><h4>Colombia</h4><p><b>141</b> · Línea de protección del ICBF<br><b>teprotejo.org</b> · reporte confidencial (Te Protejo)</p></div>
<div class="glass-dark"><h4>México</h4><p><b>088</b> · Guardia Nacional, atención ciudadana para ciberdelitos<br><b>teprotejo.org</b> · también opera para México</p></div>
<div class="glass-dark"><h4>Argentina</h4><p><b>102</b> · Línea de niñas, niños y adolescentes<br><b>argentina.gob.ar</b> · guía «¿Qué puedo hacer ante un caso de grooming?»</p></div>
<div class="glass-dark"><h4>Chile</h4><p><b>147</b> · Fono Niños de Carabineros</p></div>
<div class="glass-dark"><h4>En cualquier país</h4><p><b>inhope.org</b> · directorio de líneas de denuncia<br>Reporta también en la propia plataforma</p></div>
</div>
<p class="a src-note">Datos tomados de páginas oficiales consultadas el 13 de octubre de 2026. Confirma el recurso de tu país antes de usarlo. En una emergencia, llama al número de emergencias local.</p>`,
});

slide({
  id: 'cierre-gracias', grad: 11, cls: 'closing-slide', title: 'Gracias',
  phaseLabel: 'Cierre', duration: 300, timerGroup: 'cierre',
  notes: '[4:45–5:00] Cierre. Repita la idea central y agradezca. Si alguien quiere hablar en privado, indique cómo encontrarle.',
  body: `<h1 class="a closing-title">Gracias</h1>
<p class="a closing-sub">Sospechar no es probar. Proteger no es acusar.</p>
<div class="a closing-links">
<span class="closing-link">🔎 Verificar</span>
<span class="closing-link">🙊 No compartir</span>
<span class="closing-link">🗣️ Contar</span>
<span class="closing-link">🗂️ Guardar y denunciar</span>
</div>
<p class="a date-text" style="margin-top:28px">${esc(CASE_INFO.disclaimer)}</p>`,
});

// ───────────────────────── Mapa de proyección ─────────────────────────
const index = Object.fromEntries(slides.map((s, i) => [s.id, i]));
const map = {
  schema_version: SCHEMA_VERSION,
  game_id: GAME_ID,
  projection_file: 'projection/index.html',
  slide_count: slides.length,
  index_base: 0,
  rounds: {},
  segments: {
    opening: slides.filter((s) => !s.round && !s.id.startsWith('cierre')).map((s) => s.id),
    closing: slides.filter((s) => s.id.startsWith('cierre')).map((s) => s.id),
  },
};
for (const r of ROUNDS) {
  const phases = {};
  for (const s of slides.filter((x) => x.round === r.id)) {
    phases[s.phase] = phases[s.phase] || { slide_id: s.id, slide_index: index[s.id], slides: [] };
    phases[s.phase].slides.push(s.id);
  }
  map.rounds[r.id] = phases;
}

// ───────────────────────── Datos públicos y demostración ─────────────────────────
const DEMO_SCORES = { azul: [9, 2], rojo: [7, 3], verde: [7, 1], amarillo: [5, 2], morado: [3, 3] };
const demo = {};
for (const r of ROUNDS) {
  const evs = (() => { const out = []; for (const x of ROUNDS) { out.push(...EVIDENCE.filter((e) => e.round === x.id).map((e) => e.id)); if (x.id === r.id) break; } return out; })();
  demo[r.id] = {
    demo: true,
    round_id: r.id,
    phase: 'defense',
    scoreboard: TEAMS.map((t) => ({ team_id: t.id, score: DEMO_SCORES[t.id][0], objection_tokens: DEMO_SCORES[t.id][1] })),
    responses: TEAMS.map((t, i) => ({
      team_id: t.id,
      claim_id: claimId(r.id, i % r.claims.length),
      // Una sola evidencia por respuesta de ejemplo: la demostración nunca debe reproducir
      // por casualidad un argumento aceptado (la comprobación está en validate.mjs y check-leaks.mjs).
      evidence_ids: [evs[(i * 3 + 1) % evs.length]],
      action_id: actionId(r.id, i % r.actions.length),
    })),
  };
}
const deckData = {
  game_id: GAME_ID,
  teams: TEAMS,
  rounds: Object.fromEntries(ROUNDS.map((r) => [r.id, {
    claims: Object.fromEntries(r.claims.map((c, i) => [claimId(r.id, i), c])),
    actions: Object.fromEntries(r.actions.map((a, i) => [actionId(r.id, i), a])),
  }])),
  map,
  demo,
};

// ───────────────────────── Ensamblado ─────────────────────────
const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Tribunal Digital · Caso «${esc(CASE_INFO.title)}». Proyección del taller generada con make-slide (tema gradient-pop).">
  <meta name="generator" content="make-slide 2.3.2 · tema gradient-pop · plantilla themes/gradient-pop/reference.html">
  <title>Tribunal Digital · ${esc(CASE_INFO.title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <style id="embedded-font">
    /* Pretendard Variable v1.3.9 (SIL OFL 1.1, © Kil Hyung-jin, nombre reservado «Pretendard»).
       Archivo original sin modificar, incrustado para que la proyección funcione sin conexión.
       Licencia: assets/fonts/Pretendard-OFL-LICENSE.txt */
    @font-face {
      font-family: 'Pretendard Variable';
      font-weight: 45 930;
      font-style: normal;
      font-display: swap;
      src: url(data:font/woff2;base64,${fontB64}) format('woff2-variations');
    }
  </style>
  <style id="theme-gradient-pop">
${themeCss}
  </style>
  <style id="deck-extensions">
${extCss}
  </style>
</head>
<body>
  <div class="progress-bar" id="progress"></div>
  <div class="slide-counter" id="counter"></div>
  <div class="hint" id="hint"><kbd>&larr;</kbd><kbd>&rarr;</kbd> navegar <kbd>F</kbd> pantalla completa <kbd>S</kbd> notas <kbd>T</kbd> reloj <kbd>N</kbd> turno</div>
  <button class="fullscreen-btn" id="fs-btn" type="button" aria-label="Pantalla completa">&#x26F6;</button>
  <div class="live-badge demo" id="live-badge" role="status" aria-live="polite">Modo demostración · datos de ejemplo</div>
${TEAMS.map((t) => `  <template id="shape-${t.id}">${teamShape(t.id)}</template>`).join('\n')}

  <div class="deck" id="deck">
    <div class="timer" id="timer" aria-live="off"><span class="t-label"></span><span class="t-turn"></span><span class="t-time">0:00</span><button type="button" aria-label="Iniciar reloj">▶</button><span class="t-bar"><i></i></span></div>
${slides.map((s, i) => (i === 0 ? s.html.replace('class="slide ', 'class="slide active ') : s.html)).join('\n\n')}
  </div>

  <script type="application/json" id="deck-data">${JSON.stringify(deckData).replace(/</g, '\\u003c')}</script>
  <script>
${runtime}
  </script>
</body>
</html>
`;

writeFileSync(path.join(ROOT, 'projection', 'index.html'), html, 'utf8');
writeFileSync(path.join(ROOT, 'content', 'projection-map.json'), JSON.stringify(map, null, 2) + '\n', 'utf8');
console.log(`✓ projection/index.html (${slides.length} diapositivas, ${(html.length / 1024 / 1024).toFixed(2)} MB)`);
console.log('✓ content/projection-map.json');
