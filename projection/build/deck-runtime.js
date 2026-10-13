/* ==========================================================================
   TRIBUNAL DIGITAL — motor de la proyección
   Base: make-slide core-features (navegación, barra de progreso, contador,
   pantalla completa y notas en ventana emergente). Extensiones: escenario 16:9,
   reloj de fase, enlaces por #id y marcador en vivo/demostración.
   Este archivo no contiene (ni recibe) respuestas ni claves de puntuación.
   ========================================================================== */
(function () {
  'use strict';

  var DATA = JSON.parse(document.getElementById('deck-data').textContent);

  /* ---------- Escenario 16:9 escalado ---------- */
  var deck = document.getElementById('deck');
  function fitStage() {
    var s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    document.documentElement.style.setProperty('--stage-scale', String(s));
  }
  window.addEventListener('resize', fitStage);
  fitStage();

  /* ---------- Navegación (make-slide core-features) ---------- */
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var current = 0;

  function goTo(index) {
    if (index < 0 || index >= slides.length) return;
    slides[current].classList.remove('active');
    slides[index].classList.add('active');
    current = index;
    updateProgress();
    updateCounter();
    updateNotes();
    onSlideChange();
  }

  function updateProgress() {
    document.getElementById('progress').style.width =
      (current / (slides.length - 1) * 100) + '%';
  }

  function updateCounter() {
    document.getElementById('counter').textContent =
      (current + 1) + ' / ' + slides.length;
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      var p = document.documentElement.requestFullscreen();
      if (p && p.catch) p.catch(function () {});
    } else {
      document.exitFullscreen();
    }
  }
  window.toggleFullscreen = toggleFullscreen;

  /* ---------- Notas del presentador: VENTANA EMERGENTE (make-slide) ---------- */
  var notesWindow = null;

  function toggleNotes() {
    if (notesWindow && !notesWindow.closed) {
      notesWindow.close();
      notesWindow = null;
      return;
    }
    notesWindow = window.open('', 'SpeakerNotes', 'width=620,height=520,top=80,left=80');
    if (!notesWindow) return;
    notesWindow.document.write('<!DOCTYPE html>' +
      '<html lang="es"><head><meta charset="UTF-8"><title>Notas · Tribunal Digital</title><style>' +
      '* { margin: 0; padding: 0; box-sizing: border-box; }' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #1a1a1a; color: #e0e0e0; padding: 24px; }' +
      '.slide-num { font-size: 13px; color: #888; margin-bottom: 12px; font-family: monospace; }' +
      '.label { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #fbbf24; margin-bottom: 8px; }' +
      '.notes { font-size: 18px; line-height: 1.7; color: #ddd; white-space: pre-wrap; }' +
      '.next { margin-top: 22px; padding-top: 14px; border-top: 1px solid #333; font-size: 14px; color: #999; }' +
      '</style></head><body>' +
      '<div class="slide-num" id="sn"></div>' +
      '<div class="label">Notas del presentador</div>' +
      '<div class="notes" id="nt"></div>' +
      '<div class="next" id="nx"></div>' +
      '</body></html>');
    notesWindow.document.close();
    updateNotes();
  }

  function updateNotes() {
    if (!notesWindow || notesWindow.closed) return;
    try {
      var note = slides[current].dataset.notes || '(Sin notas)';
      notesWindow.document.getElementById('nt').textContent = note;
      notesWindow.document.getElementById('sn').textContent =
        'Diapositiva ' + (current + 1) + ' / ' + slides.length + ' · #' + slides[current].id;
      var next = slides[current + 1];
      notesWindow.document.getElementById('nx').textContent =
        next ? 'Siguiente: ' + (next.dataset.title || next.id) : 'Fin de la presentación';
    } catch (e) {}
  }

  /* ---------- Teclado, clic y gestos ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === ' ' || k === 'ArrowDown' || k === 'PageDown') { e.preventDefault(); goTo(current + 1); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); goTo(current - 1); }
    else if (k === 'Home') { e.preventDefault(); goTo(0); }
    else if (k === 'End') { e.preventDefault(); goTo(slides.length - 1); }
    else if (k.toLowerCase() === 'f') { e.preventDefault(); toggleFullscreen(); }
    else if (k.toLowerCase() === 's') { e.preventDefault(); toggleNotes(); }
    else if (k.toLowerCase() === 't') { e.preventDefault(); Timer.toggle(); }
    else if (k.toLowerCase() === 'r') { e.preventDefault(); Timer.reset(); }
    else if (k.toLowerCase() === 'n') { e.preventDefault(); Timer.nextTurn(); }
    else if (k.toLowerCase() === 'g') { e.preventDefault(); Live.jumpToPhase(); }
  });

  deck.addEventListener('click', function (e) {
    if (e.target.closest('a, button, .no-nav')) return;
    var x = e.clientX / window.innerWidth;
    if (x < 0.333) goTo(current - 1); else goTo(current + 1);
  });

  var touchStartX = 0;
  document.addEventListener('touchstart', function (e) { touchStartX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    var diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { if (diff > 0) goTo(current + 1); else goTo(current - 1); }
  }, { passive: true });

  document.getElementById('fs-btn').addEventListener('click', function (e) { e.stopPropagation(); toggleFullscreen(); });

  /* ---------- Enlaces por #id (projection-map.json) ---------- */
  function indexOfId(id) {
    for (var i = 0; i < slides.length; i++) if (slides[i].id === id) return i;
    return -1;
  }
  function syncHash() {
    var id = slides[current].id;
    if (id && location.hash !== '#' + id && window.history && history.replaceState) {
      try { history.replaceState(null, '', '#' + id); } catch (e) {}
    }
  }
  window.addEventListener('hashchange', function () {
    var i = indexOfId(decodeURIComponent(location.hash.slice(1)));
    if (i > -1 && i !== current) goTo(i);
  });

  /* ---------- Reloj de fase y turnos ---------- */
  var Timer = (function () {
    var el = document.getElementById('timer');
    var tLabel = el.querySelector('.t-label');
    var tTime = el.querySelector('.t-time');
    var tTurn = el.querySelector('.t-turn');
    var tBar = el.querySelector('.t-bar i');
    var btn = el.querySelector('button');
    var total = 0, left = 0, running = false, last = 0;
    var turns = 0, turnLen = 0, turnIdx = 0, turnLeft = 0, turnRunning = false;
    var turnNames = [];

    function fmt(s) {
      s = Math.max(0, Math.ceil(s));
      return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
    }
    function render() {
      tTime.textContent = fmt(left);
      tBar.style.transform = 'scaleX(' + (total ? Math.max(0, left / total) : 0) + ')';
      el.classList.toggle('running', running);
      el.classList.toggle('done', total > 0 && left <= 0);
      btn.textContent = running ? '❚❚' : '▶';
      btn.setAttribute('aria-label', running ? 'Pausar reloj' : 'Iniciar reloj');
      if (turns) {
        tTurn.classList.add('show');
        var who = turnNames[turnIdx] ? ' · ' + turnNames[turnIdx] : '';
        tTurn.textContent = 'Turno ' + (turnIdx + 1) + '/' + turns + who + ' · ' + fmt(turnLeft);
      } else tTurn.classList.remove('show');
    }
    function tick(now) {
      var dt = (now - last) / 1000;
      last = now;
      if (running) left = Math.max(0, left - dt);
      if (turnRunning) turnLeft = Math.max(0, turnLeft - dt);
      if (left <= 0) running = false;
      if (turnLeft <= 0) turnRunning = false;
      render();
      if (running || turnRunning) requestAnimationFrame(tick);
    }
    function start() { if (!total) return; if (left <= 0) left = total; running = true; last = performance.now(); requestAnimationFrame(tick); render(); }
    var group = null;
    function setup(slide) {
      var g = slide.dataset.timerGroup || null;
      if (g && g === group) {
        // Mismo bloque de tiempo (p. ej. revelación + evidencias): el reloj sigue corriendo.
        tLabel.textContent = slide.dataset.phaseLabel || '';
        el.classList.toggle('show', total > 0);
        render();
        return;
      }
      group = g;
      running = false; turnRunning = false;
      total = Number(slide.dataset.duration || 0);
      left = total;
      turns = Number(slide.dataset.turns || 0);
      turnLen = Number(slide.dataset.turnSeconds || 0);
      turnNames = (slide.dataset.turnNames || '').split('|').filter(Boolean);
      turnIdx = 0; turnLeft = turnLen;
      tLabel.textContent = slide.dataset.phaseLabel || '';
      el.classList.toggle('show', total > 0);
      render();
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); api.toggle(); });
    var api = {
      setup: setup,
      toggle: function () { if (!total) return; if (running) { running = false; render(); } else start(); },
      reset: function () { running = false; turnRunning = false; left = total; turnIdx = 0; turnLeft = turnLen; render(); },
      nextTurn: function () {
        if (!turns) return;
        if (turnRunning || turnLeft < turnLen) turnIdx = Math.min(turns - 1, turnIdx + 1);
        turnLeft = turnLen; turnRunning = true;
        if (!running && total && left > 0) start();
        last = performance.now(); requestAnimationFrame(tick); render();
      }
    };
    return api;
  })();

  /* ---------- Estado en vivo (GET /api/public-state) o demostración ---------- */
  var Live = (function () {
    var params = new URLSearchParams(location.search);
    var forceDemo = params.get('demo') === '1';
    var follow = params.get('follow') === '1';
    var endpoint = params.get('api') || '/api/public-state';
    if (endpoint.charAt(0) !== '/' || endpoint.charAt(1) === '/') endpoint = '/api/public-state'; // solo mismo origen
    var canFetch = !forceDemo && /^https?:$/.test(location.protocol);
    var badge = document.getElementById('live-badge');
    var state = null, mode = 'demo', lastOk = null, lastPhaseKey = null, note = '';
    var teamIds = DATA.teams.map(function (t) { return t.id; });

    function pick(o, keys) { for (var i = 0; i < keys.length; i++) if (o && o[keys[i]] !== undefined && o[keys[i]] !== null) return o[keys[i]]; return undefined; }
    function num(v) { var n = Number(v); return isFinite(n) ? n : null; }

    function normalize(raw) {
      if (!raw || typeof raw !== 'object') return null;
      var s = { round_id: pick(raw, ['round_id', 'roundId', 'round']), phase: pick(raw, ['phase']), scoreboard: [], responses: [] };
      var sb = pick(raw, ['scoreboard']);
      var rows = [];
      if (Array.isArray(sb)) rows = sb;
      else if (sb && typeof sb === 'object') rows = Object.keys(sb).map(function (k) { var r = sb[k] || {}; return Object.assign({ team_id: k }, typeof r === 'object' ? r : { score: r }); });
      rows.forEach(function (r) {
        var id = pick(r, ['team_id', 'teamId', 'team', 'id']);
        if (teamIds.indexOf(id) < 0) return;
        s.scoreboard.push({
          team_id: id,
          score: num(pick(r, ['score', 'points', 'total'])) || 0,
          tokens: num(pick(r, ['objection_tokens', 'tokens_remaining', 'remaining_tokens', 'objection_tokens_remaining', 'tokens'])),
          rank: num(pick(r, ['rank', 'position']))
        });
      });
      var rs = pick(raw, ['responses', 'locked_responses', 'team_responses']);
      var list = [];
      if (Array.isArray(rs)) list = rs;
      else if (rs && typeof rs === 'object') list = Object.keys(rs).map(function (k) { return Object.assign({ team_id: k }, rs[k]); });
      list.forEach(function (r) {
        var id = pick(r, ['team_id', 'teamId', 'team']);
        if (teamIds.indexOf(id) < 0) return;
        var ev = pick(r, ['evidence_ids', 'evidenceIds', 'evidence']);
        s.responses.push({ team_id: id, claim_id: pick(r, ['claim_id', 'claimId', 'claim']), evidence_ids: Array.isArray(ev) ? ev.slice(0, 2) : [], action_id: pick(r, ['action_id', 'actionId', 'action']) });
      });
      // rango denso si el servidor no lo envía
      var sorted = s.scoreboard.slice().sort(function (a, b) { return b.score - a.score; });
      sorted.forEach(function (r, i) { if (r.rank === null) r.rank = i === 0 ? 1 : (r.score === sorted[i - 1].score ? sorted[i - 1].rank : i + 1); });
      return s;
    }

    function demoFor(roundId) {
      var d = DATA.demo[roundId] || DATA.demo.R1;
      return normalize(d);
    }

    function setBadge() {
      badge.className = 'live-badge ' + mode;
      var t = lastOk ? lastOk.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
      if (mode === 'live') badge.textContent = 'En vivo · actualizado ' + t;
      else if (mode === 'stale') badge.textContent = 'Sin conexión con el servidor · últimos datos de las ' + t;
      else badge.textContent = 'Modo demostración · datos de ejemplo' + (note ? ' · ' + note : '');
    }

    function poll() {
      if (!canFetch) { setBadge(); render(); return; }
      fetch(endpoint, { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (res.status === 401 || res.status === 403) { note = 'abre la proyección desde la ruta de presentador'; throw new Error('auth'); }
          if (!res.ok) throw new Error('http ' + res.status);
          return res.json();
        })
        .then(function (raw) {
          var s = normalize(raw);
          if (!s || !s.scoreboard.length) throw new Error('formato');
          state = s; mode = 'live'; lastOk = new Date(); note = '';
          var key = s.round_id + ':' + s.phase;
          if (follow && key !== lastPhaseKey) jumpToPhase();
          lastPhaseKey = key;
        })
        .catch(function () { mode = state ? 'stale' : 'demo'; })
        .then(function () { setBadge(); render(); });
    }

    function stateFor(roundId) {
      if (mode === 'live' || mode === 'stale') return { s: state, demo: false };
      return { s: demoFor(roundId), demo: true };
    }

    function jumpToPhase() {
      if (!state) return;
      var r = DATA.map.rounds[state.round_id];
      var entry = r && r[state.phase];
      if (entry) goTo(entry.slide_index);
    }

    function render() {
      var slide = slides[current];
      var roundId = slide.dataset.round || null;
      var boxes = slide.querySelectorAll('[data-live]');
      for (var i = 0; i < boxes.length; i++) {
        var box = boxes[i];
        var rid = box.dataset.round || roundId || (state && state.round_id) || 'R1';
        var st = stateFor(rid);
        Render[box.dataset.live](box, st.s, rid, st.demo, mode);
      }
    }

    if (canFetch) { poll(); setInterval(function () { if (!document.hidden) poll(); }, 3000); }
    else setBadge();

    return { render: render, jumpToPhase: jumpToPhase };
  })();

  /* ---------- Dibujo de componentes dinámicos (solo DOM seguro, sin innerHTML) ---------- */
  function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function teamName(id) { for (var i = 0; i < DATA.teams.length; i++) if (DATA.teams[i].id === id) return DATA.teams[i].name; return id; }
  function teamBadge(id) {
    var wrap = h('span', 'team');
    var tpl = document.getElementById('shape-' + id);
    if (tpl) wrap.appendChild(tpl.content.cloneNode(true));
    wrap.appendChild(h('span', null, teamName(id)));
    return wrap;
  }
  function tokenDots(n) {
    var w = h('span', 'tokens');
    w.setAttribute('aria-label', (n === null ? 'Fichas desconocidas' : n + ' fichas de objeción'));
    for (var i = 0; i < 3; i++) w.appendChild(h('i', n !== null && i < n ? 'on' : ''));
    return w;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function short(id) { return String(id || '').replace(/^(R\d|FINAL)-/, ''); }

  var Render = {
    responses: function (box, s, roundId, demo) {
      clear(box);
      var round = DATA.rounds[roundId];
      var ok = s && s.round_id === roundId && s.responses.length;
      if (!ok) {
        box.appendChild(h('div', 'glass-dark placeholder-box', 'Las respuestas aparecerán aquí cuando cada equipo bloquee la suya.'));
        return;
      }
      var head = h('div', 'resp-head');
      ['Equipo', 'Afirmación', 'Evidencias', 'Acción'].forEach(function (t) { head.appendChild(h('span', null, t)); });
      box.appendChild(head);
      DATA.teams.forEach(function (t) {
        var r = null;
        for (var i = 0; i < s.responses.length; i++) if (s.responses[i].team_id === t.id) r = s.responses[i];
        var row = h('div', 'resp-row glass-dark');
        row.appendChild(teamBadge(t.id));
        if (!r) { var miss = h('div', 'resp-cell'); miss.appendChild(h('p', null, 'Sin respuesta bloqueada')); row.appendChild(miss); box.appendChild(row); return; }
        var c = h('div', 'resp-cell'); c.appendChild(h('span', 'chip sm', short(r.claim_id))); c.appendChild(h('p', null, (round && round.claims[r.claim_id]) || '—'));
        var e = h('div', 'resp-ev'); (r.evidence_ids || []).forEach(function (id) { e.appendChild(h('span', 'chip sm ghost', id)); });
        var a = h('div', 'resp-cell'); a.appendChild(h('span', 'chip sm', short(r.action_id))); a.appendChild(h('p', null, (round && round.actions[r.action_id]) || '—'));
        row.appendChild(c); row.appendChild(e); row.appendChild(a);
        box.appendChild(row);
      });
      if (demo) box.appendChild(h('div', 'src-note', 'Ejemplo ilustrativo: las respuestas reales llegan desde la aplicación cuando se bloquea la fase.'));
    },
    scoreboard: function (box, s, roundId, demo) {
      clear(box);
      if (!s || !s.scoreboard.length) { box.appendChild(h('div', 'glass-dark placeholder-box', 'El marcador aparecerá aquí.')); return; }
      var rows = s.scoreboard.slice().sort(function (a, b) { return a.rank - b.rank || DATA.teams.findIndex(function (t) { return t.id === a.team_id; }) - DATA.teams.findIndex(function (t) { return t.id === b.team_id; }); });
      rows.forEach(function (r) {
        var row = h('div', 'board-row glass-dark' + (r.rank === 1 ? ' first' : ''));
        row.appendChild(h('div', 'rank', String(r.rank)));
        row.appendChild(teamBadge(r.team_id));
        var tk = h('div'); tk.appendChild(h('span', 'tokens-label', 'Fichas')); tk.appendChild(tokenDots(r.tokens)); row.appendChild(tk);
        var sc = h('div', 'score', String(r.score)); sc.appendChild(h('small', null, 'pts')); row.appendChild(sc);
        box.appendChild(row);
      });
      if (demo) box.appendChild(h('div', 'src-note', 'Marcador de ejemplo (modo demostración). En vivo, los datos llegan de /api/public-state.'));
    },
    tokens: function (box, s, roundId, demo) {
      clear(box);
      DATA.teams.forEach(function (t) {
        var r = null;
        if (s) for (var i = 0; i < s.scoreboard.length; i++) if (s.scoreboard[i].team_id === t.id) r = s.scoreboard[i];
        var card = h('div', 'token-card glass-dark');
        card.appendChild(teamBadge(t.id));
        card.appendChild(tokenDots(r ? r.tokens : null));
        box.appendChild(card);
      });
      if (demo) { var n = h('div', 'src-note', 'Fichas de ejemplo (modo demostración).'); n.style.gridColumn = '1 / -1'; box.appendChild(n); }
    }
  };

  /* ---------- Cambio de diapositiva ---------- */
  function onSlideChange() {
    syncHash();
    Timer.setup(slides[current]);
    Live.render();
  }

  /* ---------- Inicio ---------- */
  var startAt = indexOfId(decodeURIComponent(location.hash.slice(1)));
  if (startAt > 0) { slides[0].classList.remove('active'); slides[startAt].classList.add('active'); current = startAt; }
  updateProgress();
  updateCounter();
  onSlideChange();
})();
