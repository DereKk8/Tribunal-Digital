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

  TD.comprobarDemo('cinta');

  // ------------------------------------------------------------------ acceso
  function mostrarAcceso(mensajeError) {
    detenerSondeo();
    estado = null;
    claveVista = '';
    delete document.body.dataset.equipo;
    $('pantalla-juego').hidden = true;
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
  function tag(id, clara) { return '<span class="tag' + (clara ? ' clara' : '') + '">' + esc(id) + '</span>'; }
  function nombreRonda(id) { return id === 'FINAL' ? 'Ronda final' : 'Ronda ' + id.replace(/^R/, ''); }

  function cabeceraRonda() {
    return '<header class="ronda-cabecera"><span class="ronda-codigo">' + esc(nombreRonda(estado.round_id)) + '</span><h1 class="ronda-titulo display">' + esc(estado.round_title || '') + '</h1></header>';
  }

  function exhibicion(e) {
    return '<li class="exhibicion"><figure><img src="' + esc(e.media_url) + '" alt="Imagen de la evidencia ' + esc(e.id) + '" loading="lazy">' + tag(e.id) +
      '</figure><div class="exhibicion-texto">' + esc(e.body) + '</div></li>';
  }

  function evidenciasAnteriores() {
    var previas = (estado.released_evidence || []).filter(function (e) { return e.revealed_in !== estado.round_id; });
    if (!previas.length) return '';
    return '<details class="archivo"><summary>Evidencia de rondas anteriores (' + previas.length + ')</summary><ul class="exhibiciones">' + previas.map(exhibicion).join('') + '</ul></details>';
  }

  function evidenciasNuevas() {
    var nuevas = (estado.released_evidence || []).filter(function (e) { return e.revealed_in === estado.round_id; });
    if (!nuevas.length) return '';
    return '<h2 class="seccion">Evidencia nueva</h2><ul class="exhibiciones">' + nuevas.map(exhibicion).join('') + '</ul>';
  }

  function detalleRespuesta(r) {
    var ronda = estado.round || { claims: [], actions: [] };
    return '<dl class="alegato-detalle">' +
      '<div><dt>Afirmación</dt><dd>' + tag(r.claim_id) + esc(r.claim_text || textoDe(ronda.claims, r.claim_id)) + '</dd></div>' +
      '<div><dt>Evidencia</dt><dd>' + r.evidence_ids.map(function (id) {
        var e = evidencia(id);
        return '<p class="linea">' + tag(id, true) + (e ? esc(e.body) : '') + '</p>';
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
      return '<p class="indicacion">Su equipo no selló respuesta en esta ronda. Obtiene 0 en afirmación y acción, pero puede objetar.</p>';
    }
    return '<section class="sellada">' + selloEquipo() + '<h2 class="display">Respuesta sellada</h2><p>Sellada a las ' + esc(hora(estado.my_response.submitted_at)) +
      '. Ya no se puede cambiar.</p>' + detalleRespuesta(estado.my_response) + '</section>';
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
    }).join('') + '</ol><p class="marcador-pie">Desempate: más objeciones válidas, luego más afirmaciones bien sostenidas. Si sigue igual, victoria conjunta.</p>';
  }

  function opcion(tipo, nombre, valor, marcada, deshabilitada, interior) {
    return '<label class="opcion"><input type="' + tipo + '" name="' + nombre + '" value="' + esc(valor) + '"' + (marcada ? ' checked' : '') + (deshabilitada ? ' disabled' : '') +
      '><span>' + interior + '</span></label>';
  }

  // ------------------------------------------------------------------ vistas por fase
  function vTutorial() {
    return '<header class="ronda-cabecera"><span class="ronda-codigo">Antes de empezar</span><h1 class="ronda-titulo display">Cómo funciona el tribunal</h1></header>' +
      (estado.case_title ? '<p class="indicacion">' + esc(estado.case_title) + '</p>' : '') +
      '<ol class="reglas">' +
      '<li>En cada ronda se revela evidencia nueva. Todos los equipos ven la misma.</li>' +
      '<li>Su equipo decide una respuesta: una afirmación, una o dos evidencias que la sostengan y una acción de protección.</li>' +
      '<li>La respuesta se sella una sola vez desde este teléfono. Después no se puede cambiar.</li>' +
      '<li>Al cerrar la decisión, las cinco respuestas se hacen públicas y una persona portavoz, distinta en cada ronda, defiende la de su equipo.</li>' +
      '<li>Pueden objetar la respuesta de otro equipo: eligen el equipo, la categoría y la evidencia que lo demuestra.</li>' +
      '</ol><h2 class="seccion">Qué suma puntos</h2><ul class="tarifas">' +
      '<li><span class="pts">+3</span><span>Afirmación sostenida con las evidencias correctas.</span></li>' +
      '<li><span class="pts">+2</span><span>Acción de protección válida.</span></li>' +
      '<li><span class="pts">+3</span><span>Objeción correcta contra la respuesta sellada de otro equipo.</span></li>' +
      '<li><span class="pts nada">0</span><span>Hablar mejor, más rápido o ser más popular. El debate es libre y no puntúa.</span></li>' +
      '</ul><h2 class="seccion">Fichas de objeción</h2><p>Cada equipo tiene tres para todo el juego y puede usar una por fase como máximo. La ficha se gasta aunque la objeción no sea válida.</p>' +
      '<p class="indicacion">Esperen a que la moderación abra la primera ronda.</p>';
  }

  function vRevelacion() {
    return cabeceraRonda() + '<p class="indicacion">Lean la evidencia nueva. La decisión se abre en la siguiente fase.</p>' + evidenciasNuevas() +
      '<h2 class="seccion">Afirmaciones posibles</h2><ul class="lista-lectura">' + estado.round.claims.map(function (c) { return '<li>' + tag(c.id) + '<span>' + esc(c.text) + '</span></li>'; }).join('') + '</ul>' +
      '<h2 class="seccion">Acciones posibles</h2><ul class="lista-lectura">' + estado.round.actions.map(function (a) { return '<li>' + tag(a.id) + '<span>' + esc(a.text) + '</span></li>'; }).join('') + '</ul>' +
      evidenciasAnteriores();
  }

  function respuestaCompleta() {
    return !!(borrador.claim && borrador.action && borrador.evidence.length >= 1 && borrador.evidence.length <= 2);
  }

  function vDeliberacion() {
    if (estado.my_response) {
      return cabeceraRonda() + tarjetaSellada() + '<p class="indicacion">Cuando la moderación cierre la decisión verán las respuestas de todos los equipos.</p>';
    }
    var r = estado.round;
    var ev = (estado.released_evidence || []).slice().sort(function (a, b) {
      return (b.revealed_in === estado.round_id) - (a.revealed_in === estado.round_id);
    });
    var lleno = borrador.evidence.length >= 2;
    return cabeceraRonda() + '<form id="form-respuesta" class="hilo" novalidate>' +
      '<section class="paso' + (borrador.claim ? ' completo' : '') + '" data-paso="claim"><span class="nudo" aria-hidden="true">1</span><h2 class="paso-titulo">La afirmación</h2><p class="ayuda">Elijan una.</p>' +
      r.claims.map(function (c) { return opcion('radio', 'claim', c.id, borrador.claim === c.id, false, tag(c.id) + '<span class="opcion-texto">' + esc(c.text) + '</span>'); }).join('') + '</section>' +
      '<section class="paso' + (borrador.evidence.length ? ' completo' : '') + '" data-paso="evidence"><span class="nudo" aria-hidden="true">2</span><h2 class="paso-titulo">La evidencia que la sostiene</h2><p class="ayuda" id="ayuda-evidencias">Elijan una o dos. Llevan ' + borrador.evidence.length + ' de 2.</p>' +
      ev.map(function (e) {
        var marcada = borrador.evidence.indexOf(e.id) >= 0;
        return opcion('checkbox', 'evidence', e.id, marcada, lleno && !marcada, tag(e.id) + (e.revealed_in === estado.round_id ? '<span class="nueva">Nueva</span>' : '') +
          '<span class="opcion-texto">' + esc(e.body) + '</span><img src="' + esc(e.media_url) + '" alt="Imagen de la evidencia ' + esc(e.id) + '" loading="lazy">');
      }).join('') + '</section>' +
      '<section class="paso' + (borrador.action ? ' completo' : '') + '" data-paso="action"><span class="nudo" aria-hidden="true">3</span><h2 class="paso-titulo">La acción de protección</h2><p class="ayuda">Elijan una.</p>' +
      r.actions.map(function (a) { return opcion('radio', 'action', a.id, borrador.action === a.id, false, tag(a.id) + '<span class="opcion-texto">' + esc(a.text) + '</span>'); }).join('') + '</section>' +
      '<div class="sellar' + (respuestaCompleta() ? ' listo' : '') + '"><button type="submit" class="boton-sello" id="boton-sellar"' + (respuestaCompleta() ? '' : ' disabled') + '>Sellar respuesta</button>' +
      '<p class="nota-sello">Se sella una sola vez por equipo y no se puede cambiar.</p></div></form>';
  }

  function vDefensa() {
    return cabeceraRonda() + '<p class="indicacion">Cada portavoz defiende la respuesta de su equipo. La moderación da la palabra.</p>' +
      (estado.my_response ? '' : tarjetaSellada()) + alegatos() + evidenciasAnteriores();
  }

  function inventario() {
    var f = '';
    for (var i = 0; i < 3; i++) f += '<span class="ficha' + (i < estado.tokens_remaining ? '' : ' gastada') + '"></span>';
    var n = estado.tokens_remaining;
    return '<div class="inventario"><span class="fichas" aria-hidden="true">' + f + '</span><span><strong>' +
      (n === 1 ? 'Les queda 1 ficha.' : 'Les quedan ' + n + ' fichas.') + '</strong> Una objeción por fase como máximo.</span></div>';
  }

  function objecionCompleta() { return !!(borradorObj.target && borradorObj.kind && borradorObj.cited); }

  function vObjecion() {
    var h = cabeceraRonda() + inventario();
    if (estado.my_objection) {
      var o = estado.my_objection;
      h += '<section class="sellada"><h2 class="display">Objeción presentada</h2><p>Presentada a las ' + esc(hora(o.submitted_at)) + '. Se gastó 1 ficha.</p>' +
        '<dl class="alegato-detalle"><div><dt>Contra</dt><dd><b class="t-' + esc(o.target_team_id) + '">' + esc(nombreEquipo(o.target_team_id)) + '</b></dd></div>' +
        '<div><dt>Categoría</dt><dd>' + esc(o.objection_kind_label) + '</dd></div><div><dt>Evidencia</dt><dd>' + tag(o.cited_evidence_id, true) + '</dd></div></dl></section>';
    } else if (estado.can_object) {
      h += '<form id="form-objecion" novalidate>' +
        '<h2 class="seccion">¿A qué equipo objetan?</h2><div class="bancas">' + estado.objection_targets.map(function (id) {
          var r = (estado.responses || []).filter(function (x) { return x.team_id === id; })[0];
          return '<label class="banca t-' + esc(id) + '"><input type="radio" name="target" value="' + esc(id) + '"' + (borradorObj.target === id ? ' checked' : '') + '><span class="banca-cuerpo"><span class="banca-nombre">' +
            esc(nombreEquipo(id)) + '</span>' + (r ? '<span class="banca-resumen">' + esc(r.claim_id) + ', ' + esc(r.evidence_ids.join(', ')) + ', ' + esc(r.action_id) + '</span>' : '') + '</span></label>';
        }).join('') + '</div>' +
        '<h2 class="seccion">¿Qué falla en su respuesta?</h2>' + estado.objection_kinds.map(function (k) {
          return opcion('radio', 'kind', k.id, borradorObj.kind === k.id, false, '<strong>' + esc(k.label) + '</strong><br><span class="ayuda">' + esc(k.help) + '</span>');
        }).join('') +
        '<h2 class="seccion">¿Qué evidencia lo demuestra?</h2>' + (estado.released_evidence || []).map(function (e) {
          return opcion('radio', 'cited', e.id, borradorObj.cited === e.id, false, tag(e.id, true) + '<span class="opcion-texto">' + esc(e.body) + '</span>');
        }).join('') +
        '<button type="submit" class="lacre boton-objetar" id="boton-objetar"' + (objecionCompleta() ? '' : ' disabled') + '>Presentar objeción</button>' +
        '<p class="costo">Gasta 1 ficha aunque la objeción no sea válida.</p><p class="ayuda">Si deciden no objetar, no envíen nada y conservan la ficha.</p></form>';
    } else {
      h += '<p class="indicacion">' + esc(estado.objection_block_reason || 'Ahora no pueden objetar.') + '</p>';
    }
    return h + alegatos();
  }

  function vConfrontacion() {
    return cabeceraRonda() + '<p class="indicacion">Quien objeta expone y el equipo objetado se defiende. La defensa es libre y no suma puntos.</p>' +
      '<h2 class="seccion">Objeciones presentadas</h2>' + listaObjeciones() + alegatos();
  }

  function cifra(valor, que, vacio) {
    if (vacio) return '<div class="cifra"><span class="num cero">—</span><span class="que">' + esc(que) + '</span></div>';
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
    $('banda-equipo').textContent = 'Equipo ' + s.team.name;
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
    if (borrador.ronda !== estado.round_id) borrador = { ronda: estado.round_id, claim: null, evidence: [], action: null };
    if (borradorObj.ronda !== estado.round_id) borradorObj = { ronda: estado.round_id, target: null, kind: null, cited: null };
    var clave = calcularClave(estado);
    if (clave === claveVista) return;
    var cambioFase = !claveVista || JSON.parse(claveVista)[0] !== estado.stage_index;
    claveVista = clave;
    var cont = $('contenido');
    cont.innerHTML = (VISTAS[estado.phase] || vTutorial)() +
      '<div class="salida"><button type="button" class="enlace-discreto" id="boton-salir">Cerrar sesión en este teléfono</button></div>';
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
      if (ayuda) ayuda.textContent = 'Elijan una o dos. Llevan ' + borrador.evidence.length + ' de 2.';
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
      '<p class="costo">Se gasta 1 ficha aunque no sea válida. No se puede deshacer.</p>';
    TD.confirmar({ titulo: '¿Presentar la objeción?', cuerpoHtml: cuerpo, aceptar: 'Presentar objeción', peligro: true }).then(function (ok) {
      if (!ok) return;
      enviar('/api/team/objection', payload, function (data) {
        var n = data.tokens_remaining;
        return 'Objeción presentada. ' + (n === 1 ? 'Les queda 1 ficha.' : 'Les quedan ' + n + ' fichas.');
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
