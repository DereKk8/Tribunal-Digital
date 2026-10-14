/* Tribunal Digital — pantalla del equipo (móvil). Sin dependencias. */
(function () {
  'use strict';
  var TD = window.TD;
  var esc = TD.esc;
  var $ = function (id) { return document.getElementById(id); };

  var estado = null;
  var claveVista = '';
  var sondeo = null;
  var generacion = 0;
  var enviando = false;
  var selloRecien = false;
  var borrador = { ronda: '', claim: null, evidence: [], action: null };
  var borradorObj = { ronda: '', target: null, kind: null, cited: null };
  var claveArchivo = '';

  TD.comprobarDemo('cinta');

  // ------------------------------------------------------------------ acceso
  function mostrarAcceso(mensajeError) {
    detenerSondeo();
    estado = null;
    claveVista = '';
    delete document.body.dataset.equipo;
    $('pantalla-juego').hidden = true;
    $('boton-pistas').hidden = true;
    if ($('archivo-pistas').open) $('archivo-pistas').close();
    if ($('visor-captura').open) $('visor-captura').close();
    $('banda').hidden = true;
    $('pantalla-acceso').hidden = false;
    var err = $('error-acceso');
    err.hidden = !mensajeError;
    err.textContent = mensajeError || '';
    document.title = 'Tribunal Digital';
  }

  $('form-acceso').addEventListener('submit', function (e) {
    e.preventDefault();
    var codigo = $('codigo').value.trim();
    if (!codigo) return mostrarAcceso('Escriban el código que les dio la moderación.');
    var boton = e.target.querySelector('button');
    boton.disabled = true;
    TD.api('POST', '/api/team/login', { code: codigo }).then(function (r) {
      boton.disabled = false;
      if (!r.ok) return mostrarAcceso(TD.mensajeError(r));
      $('codigo').value = '';
      $('pantalla-acceso').hidden = true;
      iniciarSondeo();
    });
  });

  // ------------------------------------------------------------------ sondeo
  // Cada cadena de sondeo tiene una generación: al reiniciar, la anterior se descarta.
  function detenerSondeo() {
    generacion += 1;
    if (sondeo) clearTimeout(sondeo);
    sondeo = null;
  }
  function iniciarSondeo() {
    detenerSondeo();
    consultar(generacion);
  }
  function consultar(gen) {
    TD.api('GET', '/api/team/state').then(function (r) {
      if (gen !== generacion) return;
      if (r.status === 401) return mostrarAcceso();
      if (r.red) {
        $('conexion').textContent = 'Sin conexión. Reintentando… Sus selecciones se conservan.';
        $('conexion').hidden = false;
      } else if (r.ok) {
        $('conexion').hidden = true;
        estado = r.data;
        TD.sincronizarReloj(estado.timer);
        pintar();
      } else {
        $('conexion').textContent = TD.mensajeError(r);
        $('conexion').hidden = false;
      }
      sondeo = setTimeout(function () { consultar(gen); }, 2000);
    });
  }

  // ------------------------------------------------------------------ piezas
  function nombreEquipo(id) {
    var fila = (estado.scoreboard || []).filter(function (r) { return r.team_id === id; })[0];
    return fila ? fila.team_name : id;
  }
  function evidencia(id) {
    return (estado.released_evidence || []).filter(function (e) { return e.id === id; })[0];
  }
  function textoDe(lista, id) {
    var x = (lista || []).filter(function (i) { return i.id === id; })[0];
    return x ? x.text : '';
  }
  function hora(iso) {
    try { return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return iso; }
  }
  function signo(n) { return n > 0 ? '+' + n : String(n); }
  function tag(id, clara) { return '<span class="tag' + (clara ? ' clara' : '') + '">' + esc(id.replace(/^(R[1-4]|FINAL)-(?=[CA]\d+$)/, '')) + '</span>'; }
  function nombreRonda(id) { return id === 'FINAL' ? 'Ronda final' : 'Ronda ' + id.replace(/^R/, ''); }

  function cabeceraRonda() {
    var pregunta = estado.round && estado.round.question;
    return '<header class="ronda-cabecera"><span class="ronda-codigo">' + esc(nombreRonda(estado.round_id)) + '</span><h1 class="ronda-titulo display">' + esc(estado.round_title || '') + '</h1>' +
      (pregunta ? '<p class="ronda-pregunta">' + esc(pregunta) + '</p>' : '') + '</header>' + contextoCaso(estado.round && estado.round.context);
  }

  function contextoCaso(texto) {
    return texto ? '<section class="contexto-caso" aria-label="Historia del caso"><h2>El caso hasta ahora</h2><p>' + esc(texto) + '</p></section>' : '';
  }

  function datosEvidencia(e) {
    return '<p class="pista-resumen">' + esc(e.summary) + '</p>' + ((e.facts || []).length ? '<ul class="pista-datos">' + e.facts.map(function (dato) { return '<li>' + esc(dato) + '</li>'; }).join('') + '</ul>' : '');
  }

  function lecturaEvidencia(e) {
    return '<button type="button" class="ver-pista" data-evidence="' + esc(e.id) + '">Ver pista ' + esc(e.id) + '</button>';
  }

  function tarjetaEvidencia(e, captura) {
    return '<article class="pista"' + (captura ? ' id="pista-' + esc(e.id) + '" tabindex="-1"' : '') + '><header>' + tag(e.id, true) + '<h3>' + esc(e.title) + '</h3></header>' + datosEvidencia(e) +
      (captura ? '<details class="captura-evidencia" data-lectura="' + esc(e.id) + '"><summary>Ver captura original</summary><button type="button" class="ampliar-captura" data-image="' + esc(e.id) + '" aria-label="Ampliar captura ' + esc(e.id) + '"><img src="' + esc(e.media_url) + '" alt="Captura original de ' + esc(e.title) + '" loading="lazy"><span>Ampliar imagen</span></button></details>' : lecturaEvidencia(e)) + '</article>';
  }

  function exhibicion(e) {
    return '<li class="exhibicion">' + tarjetaEvidencia(e, false) + '</li>';
  }

  function opcionEvidencia(tipo, nombre, e, marcada, deshabilitada, nueva) {
    return '<div class="opcion-evidencia">' + opcion(tipo, nombre, e.id, marcada, deshabilitada, tag(e.id, true) +
      (nueva ? '<span class="nueva">Nueva</span>' : '') + '<span class="opcion-texto">' + esc(e.summary) + '</span>') + lecturaEvidencia(e) + '</div>';
  }

  function actualizarArchivo() {
    var evidencias = estado.released_evidence || [];
    var nuevaClave = JSON.stringify([estado.team.id, evidencias.map(function (e) { return e.id; })]);
    if (nuevaClave === claveArchivo) return;
    claveArchivo = nuevaClave;
    var contenido = $('contenido-pistas');
    var abiertas = Array.prototype.map.call(contenido.querySelectorAll('details[data-lectura][open]'), function (d) { return d.dataset.lectura; });
    contenido.innerHTML = evidencias.length ? (estado.evidence_rounds || []).slice().reverse().map(function (r) {
      var deRonda = evidencias.filter(function (e) { return e.revealed_in === r.id; });
      return '<details class="archivo-ronda" data-lectura="ronda-' + esc(r.id) + '"' + (r.id === estado.round_id ? ' open' : '') + '><summary>' + esc(nombreRonda(r.id)) + ' · ' + esc(r.title) + '</summary>' +
        contextoCaso(r.context) + deRonda.map(function (e) { return tarjetaEvidencia(e, true); }).join('') + '</details>';
    }).join('') : contextoCaso(estado.case_intro) + '<p>Las primeras pistas aparecen cuando empieza la ronda 1.</p>';
    if (abiertas.length) contenido.querySelectorAll('details[data-lectura]').forEach(function (d) { d.open = abiertas.indexOf(d.dataset.lectura) >= 0 || d.open; });
  }

  function abrirArchivo(id) {
    actualizarArchivo();
    if (!$('archivo-pistas').open) $('archivo-pistas').showModal();
    if (id) {
      var tarjeta = document.getElementById('pista-' + id);
      if (tarjeta) {
        tarjeta.closest('.archivo-ronda').open = true;
        tarjeta.focus({ preventScroll: true });
        tarjeta.scrollIntoView({ block: 'start' });
      }
    }
  }

  $('boton-pistas').addEventListener('click', function () { abrirArchivo(); });
  $('cerrar-pistas').addEventListener('click', function () { $('archivo-pistas').close(); });
  $('cerrar-captura').addEventListener('click', function () { $('visor-captura').close(); });
  document.addEventListener('click', function (event) {
    var enlace = event.target.closest('[data-evidence]');
    if (enlace) abrirArchivo(enlace.dataset.evidence);
    var ampliar = event.target.closest('[data-image]');
    if (ampliar) {
      var e = evidencia(ampliar.dataset.image);
      if (!e) return;
      $('titulo-captura').textContent = e.title;
      $('imagen-captura').src = e.media_url;
      $('imagen-captura').alt = 'Captura original de ' + e.title;
      $('visor-captura').showModal();
    }
  });

  function evidenciasNuevas() {
    var nuevas = (estado.released_evidence || []).filter(function (e) { return e.revealed_in === estado.round_id; });
    if (!nuevas.length) return '';
    return '<h2 class="seccion">Pistas nuevas</h2><ul class="exhibiciones">' + nuevas.map(exhibicion).join('') + '</ul>';
  }

  function detalleRespuesta(r) {
    var ronda = estado.round || { claims: [], actions: [] };
    return '<dl class="alegato-detalle">' +
      '<div><dt>Afirmación</dt><dd>' + tag(r.claim_id) + esc(r.claim_text || textoDe(ronda.claims, r.claim_id)) + '</dd></div>' +
      '<div><dt>Evidencia</dt><dd>' + r.evidence_ids.map(function (id) {
        var e = evidencia(id);
        return '<p class="linea">' + tag(id, true) + (e ? esc(e.summary) : '') + '</p>' + (e ? lecturaEvidencia(e) : '');
      }).join('') + '</dd></div>' +
      '<div><dt>Acción</dt><dd>' + tag(r.action_id) + esc(r.action_text || textoDe(ronda.actions, r.action_id)) + '</dd></div></dl>';
  }

  function selloEquipo() {
    var inicial = (estado.team.name || '?').charAt(0).toUpperCase();
    var clase = selloRecien ? ' recien' : '';
    selloRecien = false;
    return '<div class="sello' + clase + '" aria-hidden="true">' + esc(inicial) + '</div>';
  }

  function tarjetaSellada() {
    if (!estado.my_response) {
      return '<p class="indicacion">Su equipo no selló respuesta y suma 0, pero todavía puede objetar.</p>';
    }
    return '<section class="sellada">' + selloEquipo() + '<h2 class="display">Respuesta sellada</h2><p>La sellamos a las ' + esc(hora(estado.my_response.submitted_at)) +
      ' y ya no podemos cambiarla.</p>' + detalleRespuesta(estado.my_response) + '</section>';
  }

  function alegatos() {
    var rs = estado.responses || [];
    if (!rs.length) return '';
    return '<h2 class="seccion">Respuestas públicas</h2><ol class="alegatos">' + rs.map(function (r) {
      var propio = r.team_id === estado.team.id;
      var cab = '<div class="alegato-equipo">' + esc(nombreEquipo(r.team_id)) + (propio ? '<small>Su equipo</small>' : '') + '</div>';
      if (r.status !== 'submitted') {
        return '<li class="alegato ausente t-' + esc(r.team_id) + (propio ? ' propio' : '') + '"><div class="alegato-cuerpo">' + cab + 'No selló respuesta en esta ronda.</div></li>';
      }
      return '<li class="alegato t-' + esc(r.team_id) + (propio ? ' propio' : '') + '"><div class="alegato-cuerpo">' + cab +
        '<p class="linea">' + tag(r.claim_id) + esc(r.claim_text) + '</p>' +
        '<p class="linea">' + r.evidence_ids.map(function (id) { return tag(id, true); }).join('') + '</p>' +
        '<p class="linea">' + tag(r.action_id) + esc(r.action_text) + '</p></div></li>';
    }).join('') + '</ol>';
  }

  function listaObjeciones() {
    var os = estado.objections || [];
    if (!os.length) return '<p class="ayuda">Nadie presentó objeciones en esta ronda.</p>';
    return '<ul class="objeciones">' + os.map(function (o) {
      var v = o.valid === true ? '<span class="veredicto-obj valida">Válida, +3</span>' : (o.valid === false ? '<span class="veredicto-obj no-valida">No válida</span>' : '');
      return '<li><p class="quien"><b class="t-' + esc(o.attacking_team_id) + '">' + esc(nombreEquipo(o.attacking_team_id)) + '</b> objeta a <b class="t-' +
        esc(o.target_team_id) + '">' + esc(nombreEquipo(o.target_team_id)) + '</b> ' + v + '</p><p class="linea">' + esc(o.objection_kind_label) + ', citando ' + tag(o.cited_evidence_id, true) + '</p></li>';
    }).join('') + '</ul>';
  }

  function marcador() {
    var filas = estado.scoreboard || [];
    var max = Math.max.apply(null, filas.map(function (r) { return r.score; }).concat([1]));
    return '<ol class="marcador">' + filas.map(function (r) {
      return '<li class="t-' + esc(r.team_id) + (r.team_id === estado.team.id ? ' propia' : '') + '"><span class="puesto">' + esc(r.rank) + '</span><span class="nombre">' + esc(r.team_name) +
        '</span><span class="barra"><i data-pct="' + Math.round((r.score / max) * 100) + '"></i></span><span class="pts">' + esc(r.score) + '</span></li>';
    }).join('') + '</ol><details class="archivo"><summary>¿Cómo se desempata?</summary><p>Gana quien tenga más objeciones válidas, después más afirmaciones sostenidas y, si siguen empatados, comparten la victoria.</p></details>';
  }

  function opcion(tipo, nombre, valor, marcada, deshabilitada, interior) {
    return '<label class="opcion"><input type="' + tipo + '" name="' + nombre + '" value="' + esc(valor) + '"' + (marcada ? ' checked' : '') + (deshabilitada ? ' disabled' : '') +
      '><span>' + interior + '</span></label>';
  }

  // ------------------------------------------------------------------ vistas por fase
  function vTutorial() {
    return '<header class="ronda-cabecera"><span class="ronda-codigo">Antes de empezar</span><h1 class="ronda-titulo display">Cómo jugamos</h1></header>' +
      (estado.case_title ? '<p class="indicacion">' + esc(estado.case_title) + '</p>' : '') +
      contextoCaso(estado.case_intro) +
      '<ol class="reglas">' +
      '<li>Revisamos las mismas pistas que los demás equipos.</li>' +
      '<li>Elegimos una afirmación, una o dos evidencias y una acción.</li>' +
      '<li>Sellamos una respuesta desde este teléfono y ya no podemos cambiarla.</li>' +
      '<li>Una persona distinta del equipo defiende la respuesta en cada ronda.</li>' +
      '<li>Si otra respuesta falla, podemos objetarla eligiendo el equipo, el motivo y una evidencia.</li>' +
      '</ol><h2 class="seccion">Qué suma puntos</h2><ul class="tarifas">' +
      '<li><span class="pts">+3</span><span>Una afirmación respaldada por las evidencias correctas.</span></li>' +
      '<li><span class="pts">+2</span><span>Una acción que proteja a Leo.</span></li>' +
      '<li><span class="pts">+3</span><span>Una objeción válida a otro equipo.</span></li>' +
      '<li><span class="pts nada">0</span><span>El debate oral no suma puntos.</span></li>' +
      '</ul><h2 class="seccion">Fichas de objeción</h2><p>Tenemos tres fichas para todo el juego y podemos gastar una por ronda, aunque la objeción falle.</p>' +
      '<p class="indicacion">La primera ronda empieza cuando la moderación la abra.</p>';
  }

  function vRevelacion() {
    return cabeceraRonda() + evidenciasNuevas() + '<p class="indicacion">Primero leemos las pistas; elegimos nuestra respuesta en la siguiente fase.</p>';
  }

  function respuestaCompleta() {
    return !!(borrador.claim && borrador.action && borrador.evidence.length >= 1 && borrador.evidence.length <= 2);
  }

  function vDeliberacion() {
    if (estado.my_response) {
      return cabeceraRonda() + tarjetaSellada() + '<p class="indicacion">Las demás respuestas aparecen cuando la moderación cierre esta fase.</p>';
    }
    var r = estado.round;
    var ev = (estado.released_evidence || []).slice().sort(function (a, b) {
      return (b.revealed_in === estado.round_id) - (a.revealed_in === estado.round_id);
    });
    var lleno = borrador.evidence.length >= 2;
    var nuevas = ev.filter(function (e) { return e.revealed_in === estado.round_id; });
    var anteriores = ev.filter(function (e) { return e.revealed_in !== estado.round_id; });
    var anterioresElegidas = anteriores.filter(function (e) { return borrador.evidence.indexOf(e.id) >= 0; }).length;
    function opcionesDe(lista) {
      return lista.map(function (e) {
        var marcada = borrador.evidence.indexOf(e.id) >= 0;
        return opcionEvidencia('checkbox', 'evidence', e, marcada, lleno && !marcada, e.revealed_in === estado.round_id);
      }).join('');
    }
    return cabeceraRonda() + '<form id="form-respuesta" class="hilo" novalidate>' +
      '<section class="paso' + (borrador.claim ? ' completo' : '') + '" data-paso="claim"><span class="nudo" aria-hidden="true">1</span><h2 class="paso-titulo">¿Qué creemos?</h2><p class="ayuda">Elegimos una afirmación.</p>' +
      r.claims.map(function (c) { return opcion('radio', 'claim', c.id, borrador.claim === c.id, false, tag(c.id) + '<span class="opcion-texto">' + esc(c.text) + '</span>'); }).join('') + '</section>' +
      '<section class="paso' + (borrador.evidence.length ? ' completo' : '') + '" data-paso="evidence"><span class="nudo" aria-hidden="true">2</span><h2 class="paso-titulo">¿Qué lo demuestra?</h2><p class="ayuda" id="ayuda-evidencias">Elegimos una o dos (' + borrador.evidence.length + '/2).</p>' +
      opcionesDe(nuevas) + (anteriores.length ? '<details id="pistas-anteriores-respuesta" class="archivo pistas-previas" data-lectura="opciones-previas"' + (anterioresElegidas ? ' open' : '') + '><summary>Pistas anteriores (' + anteriores.length + ')<span id="anteriores-elegidas">' + (anterioresElegidas ? ' · ' + anterioresElegidas + ' elegidas' : '') + '</span></summary>' + opcionesDe(anteriores) + '</details>' : '') + '</section>' +
      '<section class="paso' + (borrador.action ? ' completo' : '') + '" data-paso="action"><span class="nudo" aria-hidden="true">3</span><h2 class="paso-titulo">¿Qué hacemos?</h2><p class="ayuda">Elegimos una acción.</p>' +
      r.actions.map(function (a) { return opcion('radio', 'action', a.id, borrador.action === a.id, false, tag(a.id) + '<span class="opcion-texto">' + esc(a.text) + '</span>'); }).join('') + '</section>' +
      '<div class="sellar' + (respuestaCompleta() ? ' listo' : '') + '"><button type="submit" class="boton-sello" id="boton-sellar"' + (respuestaCompleta() ? '' : ' disabled') + '>Sellar respuesta</button>' +
      '<p class="nota-sello">Al sellarla, la respuesta queda fija.</p></div></form>';
  }

  function vDefensa() {
    return cabeceraRonda() + '<p class="indicacion">Nuestro portavoz defiende la respuesta cuando la moderación le dé la palabra.</p>' +
      (estado.my_response ? '' : tarjetaSellada()) + alegatos();
  }

  function inventario() {
    var f = '';
    for (var i = 0; i < 3; i++) f += '<span class="ficha' + (i < estado.tokens_remaining ? '' : ' gastada') + '"></span>';
    var n = estado.tokens_remaining;
    return '<div class="inventario"><span class="fichas" aria-hidden="true">' + f + '</span><span><strong>' +
      (n === 1 ? 'Nos queda 1 ficha.' : 'Nos quedan ' + n + ' fichas.') + '</strong> Podemos gastar una en esta ronda.</span></div>';
  }

  function objecionCompleta() { return !!(borradorObj.target && borradorObj.kind && borradorObj.cited); }

  function vObjecion() {
    var h = cabeceraRonda() + inventario();
    if (estado.my_objection) {
      var o = estado.my_objection;
      h += '<section class="sellada"><h2 class="display">Objeción presentada</h2><p>La presentamos a las ' + esc(hora(o.submitted_at)) + ' y gastamos una ficha.</p>' +
        '<dl class="alegato-detalle"><div><dt>Contra</dt><dd><b class="t-' + esc(o.target_team_id) + '">' + esc(nombreEquipo(o.target_team_id)) + '</b></dd></div>' +
        '<div><dt>Categoría</dt><dd>' + esc(o.objection_kind_label) + '</dd></div><div><dt>Evidencia</dt><dd>' + tag(o.cited_evidence_id, true) + '</dd></div></dl></section>';
    } else if (estado.can_object) {
      h += '<form id="form-objecion" novalidate>' +
        '<h2 class="seccion">¿A quién objetamos?</h2><div class="bancas">' + estado.objection_targets.map(function (id) {
          var r = (estado.responses || []).filter(function (x) { return x.team_id === id; })[0];
          return '<label class="banca t-' + esc(id) + '"><input type="radio" name="target" value="' + esc(id) + '"' + (borradorObj.target === id ? ' checked' : '') + '><span class="banca-cuerpo"><span class="banca-nombre">' +
            esc(nombreEquipo(id)) + '</span>' + (r ? '<span class="banca-resumen">' + esc(r.claim_id) + ', ' + esc(r.evidence_ids.join(', ')) + ', ' + esc(r.action_id) + '</span>' : '') + '</span></label>';
        }).join('') + '</div>' +
        '<h2 class="seccion">¿Qué falla?</h2>' + estado.objection_kinds.map(function (k) {
          return opcion('radio', 'kind', k.id, borradorObj.kind === k.id, false, '<span class="opcion-texto">' + esc(k.help) + '</span>');
        }).join('') +
        '<h2 class="seccion">¿Qué lo demuestra?</h2>' + (estado.released_evidence || []).map(function (e) {
          return opcionEvidencia('radio', 'cited', e, borradorObj.cited === e.id, false, false);
        }).join('') +
        '<button type="submit" class="lacre boton-objetar" id="boton-objetar"' + (objecionCompleta() ? '' : ' disabled') + '>Presentar objeción</button>' +
        '<p class="costo">Gastamos una ficha aunque la objeción falle.</p><p class="ayuda">Si no objetamos, guardamos la ficha.</p></form>';
    } else {
      h += '<p class="indicacion">' + esc(estado.objection_block_reason || 'Ahora no pueden objetar.') + '</p>';
    }
    return h + alegatos();
  }

  function vConfrontacion() {
    return cabeceraRonda() + '<p class="indicacion">Escuchemos la objeción y la defensa, que no suman puntos por hablar.</p>' +
      '<h2 class="seccion">Objeciones presentadas</h2>' + listaObjeciones() + alegatos();
  }

  function cifra(valor, que, vacio) {
    if (vacio) return '<div class="cifra"><span class="num cero">-</span><span class="que">' + esc(que) + '</span></div>';
    return '<div class="cifra"><span class="num' + (valor ? '' : ' cero') + '">' + esc(signo(valor)) + '</span><span class="que">' + esc(que) + '</span></div>';
  }

  function vResultados() {
    var mio = (estado.round_results || []).filter(function (r) { return r.team_id === estado.team.id; })[0];
    var h = cabeceraRonda();
    if (mio) {
      h += '<h2 class="seccion">Su resultado en esta ronda</h2><div class="cifras">' + cifra(mio.argument_points, 'Afirmación') + cifra(mio.action_points, 'Acción') +
        cifra(mio.objection_points, estado.my_objection ? 'Objeción' : 'Sin objeción', !estado.my_objection) + '</div>' +
        '<div class="total-ronda"><span>Total de la ronda</span><span class="num">' + esc(signo(mio.total)) + '</span></div>';
    }
    return h + '<h2 class="seccion">Objeciones</h2>' + listaObjeciones() + '<h2 class="seccion">Marcador</h2>' + marcador();
  }

  function vCierre() {
    var g = estado.winners || [];
    var nombres = g.map(function (id) { return '<span class="t-' + esc(id) + '">' + esc(nombreEquipo(id)) + '</span>'; }).join('');
    var frase = g.length > 1 ? 'Victoria conjunta.' : (g.length === 1 ? 'Equipo ganador.' : '');
    var h = '<section class="ganadores"><span class="ronda-codigo">Veredicto final</span><h1 class="display">' + nombres + '</h1><p>' + esc(frase) + '</p></section>' + marcador();
    var mis = estado.my_results || [];
    if (mis.length) {
      h += '<h2 class="seccion">Su recorrido</h2><ul class="tarifas">' + mis.map(function (r) {
        var partes = [];
        if (r.argument_points) partes.push('afirmación ' + signo(r.argument_points));
        if (r.action_points) partes.push('acción ' + signo(r.action_points));
        if (r.objection_points) partes.push('objeción ' + signo(r.objection_points));
        return '<li><span class="pts' + (r.total ? '' : ' nada') + '">' + esc(signo(r.total)) + '</span><span><strong>' + esc(nombreRonda(r.round_id)) + '</strong><br>' +
          esc(partes.length ? partes.join(', ') : 'Sin puntos en esta ronda') + '</span></li>';
      }).join('') + '</ul>';
    }
    return h;
  }

  // ------------------------------------------------------------------ pintado
  function pintarBanda() {
    var s = estado;
    document.body.dataset.equipo = s.team.id;
    $('banda').hidden = false;
    $('banda-equipo').textContent = 'Equipo ' + s.team.name.replace(/^Equipo\s+/, '');
    var f = '';
    for (var i = 0; i < 3; i++) f += '<span class="ficha' + (i < s.tokens_remaining ? '' : ' gastada') + '"></span>';
    $('banda-fichas').innerHTML = f;
    $('banda-fichas').setAttribute('role', 'img');
    $('banda-fichas').setAttribute('aria-label', 'Fichas de objeción: ' + s.tokens_remaining + ' de 3');
    $('banda-ronda').hidden = !s.round_id;
    $('banda-ronda').textContent = s.round_id || '';
    $('banda-nombre').textContent = s.phase_label;
    $('cinta').hidden = !s.demo;
    actualizarReloj();
  }

  function actualizarReloj() {
    if (!estado) return;
    var t = TD.reloj(estado.timer);
    $('banda-reloj').textContent = t.texto;
    $('banda-reloj').classList.toggle('cumplido', t.cumplido);
    $('drenaje').style.transform = 'scaleX(' + t.fraccion + ')';
  }

  function calcularClave(s) {
    return JSON.stringify([s.stage_index, s.round_id, !!s.my_response, !!s.my_objection, s.can_respond, s.can_object, s.tokens_remaining,
      (s.responses || []).length, (s.objections || []).map(function (o) { return o.attacking_team_id + o.valid; }).join(),
      (s.round_results || []).length, (s.released_evidence || []).length, (s.objection_targets || []).join(), (s.winners || []).join(),
      (s.scoreboard || []).map(function (r) { return r.score + ':' + r.rank; }).join(), s.objection_block_reason]);
  }

  var VISTAS = {
    tutorial: vTutorial, reveal: vRevelacion, deliberation: vDeliberacion, defense: vDefensa,
    objection: vObjecion, confrontation: vConfrontacion, resolution: vResultados, closing: vCierre,
  };

  function pintar() {
    $('pantalla-acceso').hidden = true;
    $('pantalla-juego').hidden = false;
    pintarBanda();
    $('boton-pistas').hidden = false;
    $('boton-pistas').textContent = 'Pistas (' + (estado.released_evidence || []).length + ')';
    actualizarArchivo();
    if (borrador.ronda !== estado.round_id) borrador = { ronda: estado.round_id, claim: null, evidence: [], action: null };
    if (borradorObj.ronda !== estado.round_id) borradorObj = { ronda: estado.round_id, target: null, kind: null, cited: null };
    var clave = calcularClave(estado);
    if (clave === claveVista) return;
    var cambioFase = !claveVista || JSON.parse(claveVista)[0] !== estado.stage_index;
    claveVista = clave;
    var cont = $('contenido');
    var lecturasAbiertas = Array.prototype.map.call(cont.querySelectorAll('details[data-lectura][open]'), function (d) { return d.dataset.lectura; });
    cont.innerHTML = (VISTAS[estado.phase] || vTutorial)() +
      '<div class="salida"><button type="button" class="enlace-discreto" id="boton-salir">Cerrar sesión en este teléfono</button></div>';
    if (!cambioFase) cont.querySelectorAll('details[data-lectura]').forEach(function (d) { d.open = lecturasAbiertas.indexOf(d.dataset.lectura) >= 0; });
    TD.aplicarMedidas(cont);
    if (cambioFase) {
      $('mensaje').innerHTML = '';
      window.scrollTo(0, 0);
      document.title = estado.phase_label + (estado.round_id ? ' (' + estado.round_id + ')' : '') + ' | Tribunal Digital';
    }
  }

  function aviso(tipo, texto) {
    $('mensaje').innerHTML = '<p class="mensaje ' + tipo + '">' + esc(texto) + '</p>';
  }

  // ------------------------------------------------------------------ interacción
  function marcarPasos() {
    var marcas = { claim: !!borrador.claim, evidence: borrador.evidence.length > 0, action: !!borrador.action };
    document.querySelectorAll('.paso[data-paso]').forEach(function (p) { p.classList.toggle('completo', marcas[p.getAttribute('data-paso')]); });
    var zona = document.querySelector('.sellar');
    if (zona) zona.classList.toggle('listo', respuestaCompleta());
  }

  $('contenido').addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'claim') borrador.claim = t.value;
    if (t.name === 'action') borrador.action = t.value;
    if (t.name === 'evidence') {
      var marcadas = Array.prototype.slice.call(document.querySelectorAll('input[name="evidence"]:checked')).map(function (x) { return x.value; });
      borrador.evidence = marcadas.slice(0, 2);
      var lleno = borrador.evidence.length >= 2;
      document.querySelectorAll('input[name="evidence"]').forEach(function (x) { x.disabled = lleno && !x.checked; });
      var ayuda = $('ayuda-evidencias');
      if (ayuda) ayuda.textContent = 'Elegimos una o dos (' + borrador.evidence.length + '/2).';
      var anteriores = $('anteriores-elegidas');
      if (anteriores) {
        var cantidad = document.querySelectorAll('#pistas-anteriores-respuesta input:checked').length;
        anteriores.textContent = cantidad ? ' · ' + cantidad + (cantidad === 1 ? ' elegida' : ' elegidas') : '';
      }
    }
    if (t.name === 'target') borradorObj.target = t.value;
    if (t.name === 'kind') borradorObj.kind = t.value;
    if (t.name === 'cited') borradorObj.cited = t.value;
    marcarPasos();
    var b1 = $('boton-sellar');
    if (b1) b1.disabled = !respuestaCompleta();
    var b2 = $('boton-objetar');
    if (b2) b2.disabled = !objecionCompleta();
  });

  $('contenido').addEventListener('click', function (e) {
    if (e.target.id !== 'boton-salir') return;
    TD.confirmar({
      titulo: '¿Cerrar sesión en este teléfono?',
      cuerpoHtml: '<p>Para volver a entrar necesitarán el código del equipo.</p>',
      aceptar: 'Cerrar sesión',
    }).then(function (ok) {
      if (!ok) return;
      TD.api('POST', '/api/team/logout', {}).then(function () { mostrarAcceso(); });
    });
  });

  $('contenido').addEventListener('submit', function (e) {
    e.preventDefault();
    if (enviando || !estado) return;
    if (e.target.id === 'form-respuesta') enviarRespuesta();
    if (e.target.id === 'form-objecion') enviarObjecion();
  });

  function enviarRespuesta() {
    if (!respuestaCompleta()) return;
    var r = estado.round;
    var payload = { round_id: estado.round_id, claim_id: borrador.claim, evidence_ids: borrador.evidence.slice(), action_id: borrador.action };
    var cuerpo = detalleRespuesta({
      claim_id: payload.claim_id, claim_text: textoDe(r.claims, payload.claim_id), evidence_ids: payload.evidence_ids,
      action_id: payload.action_id, action_text: textoDe(r.actions, payload.action_id),
    }) + '<p class="costo">Una vez sellada no se puede cambiar.</p>';
    TD.confirmar({ titulo: '¿Sellar la respuesta?', cuerpoHtml: cuerpo, aceptar: 'Sellar' }).then(function (ok) {
      if (!ok) return;
      enviar('/api/team/response', payload, function () {
        selloRecien = true;
        return 'Respuesta sellada.';
      });
    });
  }

  function enviarObjecion() {
    if (!objecionCompleta()) return;
    var payload = { round_id: estado.round_id, target_team_id: borradorObj.target, objection_kind: borradorObj.kind, cited_evidence_id: borradorObj.cited };
    var kind = estado.objection_kinds.filter(function (k) { return k.id === payload.objection_kind; })[0];
    var cuerpo = '<dl class="alegato-detalle"><div><dt>Contra</dt><dd><b class="t-' + esc(payload.target_team_id) + '">' + esc(nombreEquipo(payload.target_team_id)) + '</b></dd></div>' +
      '<div><dt>Categoría</dt><dd>' + esc(kind ? kind.label : payload.objection_kind) + '</dd></div><div><dt>Evidencia</dt><dd>' + tag(payload.cited_evidence_id, true) + '</dd></div></dl>' +
      '<p class="costo">Gastamos una ficha aunque falle y no podemos deshacerlo.</p>';
    TD.confirmar({ titulo: '¿Presentar la objeción?', cuerpoHtml: cuerpo, aceptar: 'Presentar objeción', peligro: true }).then(function (ok) {
      if (!ok) return;
      enviar('/api/team/objection', payload, function (data) {
        var n = data.tokens_remaining;
        return 'Objeción presentada. ' + (n === 1 ? 'Nos queda 1 ficha.' : 'Nos quedan ' + n + ' fichas.');
      });
    });
  }

  function enviar(ruta, payload, textoOk) {
    enviando = true;
    document.querySelectorAll('#contenido button[type="submit"]').forEach(function (b) { b.disabled = true; });
    aviso('info', 'Enviando…');
    TD.enviarConReintentos(ruta, payload).then(function (r) {
      enviando = false;
      if (r.ok) aviso('ok', textoOk(r.data));
      else aviso('error', TD.mensajeError(r));
      claveVista = '';
      iniciarSondeo();
    });
  }

  setInterval(actualizarReloj, 1000);
  iniciarSondeo();
})();
