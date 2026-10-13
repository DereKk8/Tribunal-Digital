/* Tribunal Digital — estrado (panel de moderación). Sin dependencias. */
(function () {
  'use strict';
  var TD = window.TD;
  var esc = TD.esc;
  var $ = function (id) { return document.getElementById(id); };

  var estado = null;
  var claveVista = '';
  var sondeo = null;
  var generacion = 0;
  var ocupado = false;

  var CATEGORIAS = { argument: 'Afirmación', action: 'Acción', objection: 'Objeción' };
  TD.comprobarDemo('cinta');

  // ------------------------------------------------------------------ acceso
  function mostrarAcceso(err) {
    detenerSondeo();
    estado = null;
    claveVista = '';
    $('pantalla-panel').hidden = true;
    $('pantalla-acceso').hidden = false;
    $('error-acceso').hidden = !err;
    $('error-acceso').textContent = err || '';
  }

  $('form-acceso').addEventListener('submit', function (e) {
    e.preventDefault();
    var boton = e.target.querySelector('button');
    boton.disabled = true;
    TD.api('POST', '/api/moderator/login', { password: $('clave').value }).then(function (r) {
      boton.disabled = false;
      if (!r.ok) return mostrarAcceso(TD.mensajeError(r));
      $('clave').value = '';
      $('pantalla-acceso').hidden = true;
      iniciarSondeo();
    });
  });

  // ------------------------------------------------------------------ sondeo
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
    TD.api('GET', '/api/moderator/state').then(function (r) {
      if (gen !== generacion) return;
      if (r.status === 401) return mostrarAcceso();
      if (r.red) {
        $('conexion').textContent = 'Sin conexión con el servidor. Reintentando…';
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

  // ------------------------------------------------------------------ utilidades
  function nombre(id) {
    var t = (estado.scoreboard || []).filter(function (r) { return r.team_id === id; })[0];
    return t ? t.team_name : id;
  }
  function eq(id) { return '<b class="t-' + esc(id) + '">' + esc(nombre(id)) + '</b>'; }
  function nombreRonda(id) { return id === 'FINAL' ? 'Ronda final' : 'Ronda ' + id.replace(/^R/, ''); }
  function etapaTexto(s) {
    if (!s) return '';
    return s.phase_label + (s.round_id ? ' (' + s.round_id + ')' : '');
  }
  function minutos(seg) {
    var m = Math.floor(seg / 60);
    var s = seg % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
  function categoria(id) { return (estado.objection_kind_labels || {})[id] || id; }
  function aviso(tipo, texto) {
    $('mensaje').innerHTML = '<p class="mensaje ' + tipo + '">' + esc(texto) + '</p>';
  }

  // ------------------------------------------------------------------ secciones
  function cabecera() {
    return '<header class="estrado-cabecera"><div class="estrado-marca">Estrado<small>Tribunal Digital</small></div><div class="herramientas">' +
      (estado.game ? '<a class="boton" href="/projection/?follow=1" target="_blank" rel="noopener">Abrir proyección</a>' +
        '<button type="button" class="quieto" data-accion="imprimir">Imprimir códigos</button>' +
        '<a class="boton quieto" href="/api/moderator/export.json" download>Exportar JSON</a>' +
        '<a class="boton quieto" href="/api/moderator/export.csv" download>Exportar CSV</a>' +
        '<button type="button" class="quieto" data-accion="reiniciar">Reiniciar partida</button>' : '') +
      '<button type="button" class="quieto" data-accion="salir">Cerrar sesión</button></div></header>';
  }

  function sinPartida() {
    return cabecera() + '<section class="mando"><div><span class="ahora-ronda">Sin partida activa</span><h1 class="ahora-fase display">Abrir la sala</h1>' +
      '<p class="ahora-titulo">Al crear la partida se generan cinco códigos de equipo nuevos.</p></div>' +
      '<div class="siguiente"><p class="siguiente-rotulo">Primer paso</p><p class="siguiente-fase">Crear partida</p><button type="button" data-accion="crear">Crear partida</button></div></section>' + avisosContenido();
  }

  /** El guion completo de 60 minutos: cada tramo mide lo que dura. */
  function riel() {
    var grupos = [];
    estado.stages.forEach(function (st) {
      var clave = st.round_id || st.phase;
      var g = grupos[grupos.length - 1];
      if (!g || g.clave !== clave) {
        g = { clave: clave, etiqueta: st.round_id ? nombreRonda(st.round_id) : st.phase_label, etapas: [], dur: 0 };
        grupos.push(g);
      }
      g.etapas.push(st);
      g.dur += st.duration_seconds;
    });
    return '<div class="riel" role="img" aria-label="Guion de la sesión: etapa ' + (estado.stage_index + 1) + ' de ' + estado.stage_count + '">' + grupos.map(function (g) {
      var enCurso = g.etapas.some(function (st) { return st.index === estado.stage_index; });
      return '<div class="grupo' + (enCurso ? ' en-curso' : '') + '" data-dur="' + g.dur + '"><div class="etapas">' + g.etapas.map(function (st) {
        var c = st.index === estado.stage_index ? ' actual' : (st.index < estado.stage_index ? ' pasada' : '');
        return '<span class="etapa' + c + '" data-dur="' + st.duration_seconds + '" title="' + esc(etapaTexto(st)) + ', ' + minutos(st.duration_seconds) + '"></span>';
      }).join('') + '</div><span class="rotulo">' + esc(g.etiqueta) + '</span></div>';
    }).join('') + '</div>';
  }

  function mando() {
    var s = estado;
    var sig = s.next_stage;
    var selladas = s.teams.filter(function (t) { return t.response_status === 'received'; }).length;
    var datos = '<span class="reloj" id="reloj"></span>';
    if (s.phase === 'deliberation') datos += '<span>Respuestas selladas: ' + selladas + ' de 5</span>';
    if (s.phase === 'objection') datos += '<span>Objeciones recibidas: ' + s.objection_count + '</span>';
    return '<section class="mando"><div><span class="ahora-ronda">' + esc(s.round_id ? nombreRonda(s.round_id) : 'Sesión') + '</span>' +
      '<h1 class="ahora-fase display" id="fase-actual">' + esc(s.phase_label) + '</h1>' +
      (s.round_title ? '<p class="ahora-titulo">' + esc(s.round_title) + '</p>' : '') + '<div class="ahora-datos">' + datos + '</div></div>' +
      (sig ? '<div class="siguiente"><p class="siguiente-rotulo">Siguiente</p><p class="siguiente-fase">' + esc(etapaTexto(sig)) + '</p>' +
        '<button type="button" data-accion="avanzar" id="boton-avanzar">Avanzar</button><p class="ayuda">La fase solo cambia cuando pulsa Avanzar. Los tiempos son orientativos.</p></div>'
        : '<div class="siguiente"><p class="siguiente-rotulo">Sesión terminada</p><p class="siguiente-fase">Clasificación publicada</p><p class="ayuda">Exporte la auditoría antes de cerrar.</p></div>') +
      '</section>';
  }

  function estadoRespuesta(v) {
    return {
      received: '<dd class="estado-sellada">Sellada</dd>',
      missing: '<dd class="estado-pendiente">Pendiente</dd>',
      absent: '<dd class="estado-ausente">Sin respuesta</dd>',
    }[v] || '<dd>—</dd>';
  }

  function bancadas() {
    return '<h2 class="seccion">Bancadas</h2><div class="bancadas">' + estado.teams.map(function (t) {
      var f = '';
      for (var i = 0; i < 3; i++) f += '<i' + (i < t.tokens_remaining ? '' : ' class="gastada"') + '></i>';
      return '<article class="bancada t-' + esc(t.id) + '"><div class="bancada-nombre">' + esc(t.name) + '</div><div class="bancada-codigo">' + esc(t.code) + '</div><dl>' +
        '<dt>Conexión</dt><dd>' + (t.connected ? '<span class="punto si"></span>En línea' : '<span class="punto"></span>' + (t.last_seen_seconds === null ? 'Sin entrar' : 'Hace ' + esc(t.last_seen_seconds) + ' s')) + '</dd>' +
        '<dt>Respuesta</dt>' + estadoRespuesta(t.response_status) +
        '<dt>Objeción</dt><dd>' + (t.objection_status === 'received' ? 'Presentada' : '—') + '</dd>' +
        '<dt>Fichas</dt><dd><span class="fichas-mini" role="img" aria-label="' + t.tokens_remaining + ' de 3">' + f + '</span></dd></dl>' +
        '<div class="puntos">' + esc(t.score) + '<small>pts</small></div></article>';
    }).join('') + '</div>';
  }

  function turnos() {
    var os = estado.objections || [];
    if (estado.phase === 'objection') {
      return '<h2 class="seccion">Turnos de palabra</h2><p>Objeciones recibidas: <strong>' + estado.objection_count + '</strong>. Se publican al cerrar la ventana.</p>';
    }
    if (!estado.objections_by_target.length) return '';
    return '<h2 class="seccion">Turnos de palabra</h2><ul class="objeciones">' + estado.objections_by_target.map(function (x) {
      var lineas = os.filter(function (o) { return o.target_team_id === x.team_id; }).map(function (o) {
        var v = o.valid === true ? ' <span class="veredicto-obj valida">válida</span>' : (o.valid === false ? ' <span class="veredicto-obj no-valida">no válida</span>' : '');
        return '<p class="linea">' + eq(o.attacking_team_id) + ': ' + esc(o.objection_kind_label) + ', citando <span class="tag clara">' + esc(o.cited_evidence_id) + '</span>' + v + '</p>';
      }).join('');
      return '<li><p class="quien">' + eq(x.team_id) + ' responde a ' + plural(x.attackers.length, 'objeción', 'objeciones') + '</p>' + lineas + '</li>';
    }).join('') + '</ul>';
  }

  function respuestas() {
    var rs = estado.responses || [];
    if (!rs.length) return '';
    return '<h2 class="seccion">Respuestas publicadas</h2><div class="desplazable"><table class="tabla"><thead><tr><th>Equipo</th><th>Afirmación</th><th>Evidencia</th><th>Acción</th></tr></thead><tbody>' +
      rs.map(function (r) {
        if (r.status !== 'submitted') return '<tr><td>' + eq(r.team_id) + '</td><td colspan="3" class="estado-ausente">Sin respuesta</td></tr>';
        return '<tr><td>' + eq(r.team_id) + '</td><td><span class="tag">' + esc(r.claim_id) + '</span> ' + esc(r.claim_text) + '</td><td>' +
          r.evidence_ids.map(function (x) { return '<span class="tag clara">' + esc(x) + '</span>'; }).join(' ') + '</td><td><span class="tag">' + esc(r.action_id) + '</span> ' + esc(r.action_text) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function marcador() {
    var filas = estado.scoreboard;
    var max = Math.max.apply(null, filas.map(function (r) { return r.score; }).concat([1]));
    var gan = (estado.winners || []).length
      ? '<p class="indicacion">' + (estado.winners.length > 1 ? 'Victoria conjunta: ' : 'Equipo ganador: ') + estado.winners.map(eq).join(' y ') + '</p>' : '';
    return '<h2 class="seccion">Marcador</h2>' + gan + '<ol class="marcador">' + filas.map(function (r) {
      return '<li class="t-' + esc(r.team_id) + '"><span class="puesto">' + esc(r.rank) + '</span><span class="nombre">' + esc(r.team_name) + '<small>' +
        plural(r.valid_objections, 'objeción válida', 'objeciones válidas') + ', ' + plural(r.supported_arguments, 'afirmación sostenida', 'afirmaciones sostenidas') + '</small></span><span class="barra"><i data-pct="' +
        Math.round((r.score / max) * 100) + '"></i></span><span class="pts">' + esc(r.score) + '</span></li>';
    }).join('') + '</ol><p class="marcador-pie">Desempate: más objeciones válidas, luego más afirmaciones sostenidas. Si persiste, victoria conjunta.</p>';
  }

  function detalle(i) {
    var d = i.detail || {};
    if (d.absent) return 'Sin respuesta';
    if (i.category === 'objection') {
      var t = d.target_snapshot || {};
      return 'Contra ' + esc(nombre(d.target_team_id)) + ', ' + esc(categoria(d.objection_kind)).toLowerCase() + ', cita ' + esc(d.cited_evidence_id) + '. Respuesta objetada: ' +
        esc(t.claim_id) + ' [' + esc((t.evidence_ids || []).join(', ')) + '] ' + esc(t.action_id);
    }
    return esc(d.claim_id) + ' [' + esc((d.evidence_ids || []).join(', ')) + '] ' + esc(d.action_id);
  }

  function explicaciones() {
    var ex = estado.explanations || [];
    return ex.slice().reverse().map(function (r, idx) {
      return '<details class="plegable" data-id="exp-' + esc(r.round_id) + '"' + (idx === 0 ? ' open' : '') + '><summary>Puntuación de ' + esc(nombreRonda(r.round_id)) + ', regla por regla</summary>' +
        '<div class="desplazable"><table class="tabla"><thead><tr><th>Equipo</th><th>Categoría</th><th>Puntos</th><th>Regla aplicada</th><th>Motivo</th><th>Detalle</th></tr></thead><tbody>' +
        r.items.map(function (i) {
          return '<tr><td>' + eq(i.team_id) + '</td><td>' + esc(CATEGORIAS[i.category] || i.category) + '</td><td class="num">' + esc(i.points) + '</td><td>' +
            (i.rule_ref ? '<span class="tag clara">' + esc(i.rule_ref) + '</span>' : '—') + '</td><td>' + esc(i.reason_label) + '</td><td>' + detalle(i) + '</td></tr>';
        }).join('') + '</tbody></table></div></details>';
    }).join('');
  }

  function historial() {
    var h = (estado.history || []).map(function (x) {
      return '<li>' + esc(new Date(x.entered_at).toLocaleTimeString('es')) + ', ' + esc(etapaTexto(estado.stages[x.stage_index])) + '</li>';
    }).join('');
    return '<details class="plegable" data-id="historial"><summary>Historial de fases</summary><ol class="historial">' + h + '</ol></details>';
  }

  function avisosContenido() {
    var w = estado.content_warnings || [];
    if (!w.length) return '';
    return '<details class="plegable" data-id="avisos"><summary>Avisos del contenido (' + w.length + ')</summary><ul>' + w.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>';
  }

  function columnas() {
    var izquierda = turnos() + respuestas();
    if (!izquierda) return marcador();
    return '<div class="columnas"><div>' + izquierda + '</div><div>' + marcador() + '</div></div>';
  }

  // ------------------------------------------------------------------ pintado
  function calcularClave(s) {
    var copia = JSON.parse(JSON.stringify(s));
    delete copia.timer;
    (copia.teams || []).forEach(function (t) { delete t.last_seen_seconds; });
    return JSON.stringify(copia);
  }

  function pintar() {
    $('pantalla-acceso').hidden = true;
    $('pantalla-panel').hidden = false;
    $('cinta').hidden = !estado.demo;
    var clave = calcularClave(estado);
    if (clave !== claveVista) {
      claveVista = clave;
      var abiertos = {};
      document.querySelectorAll('#panel details[data-id]').forEach(function (d) { abiertos[d.getAttribute('data-id')] = d.open; });
      var h = !estado.game ? sinPartida()
        : cabecera() + riel() + mando() + bancadas() + columnas() + explicaciones() + historial() + avisosContenido();
      $('panel').innerHTML = h;
      $('panel').setAttribute('data-etapa', estado.game ? String(estado.stage_index) : '');
      TD.aplicarMedidas($('panel'));
      document.querySelectorAll('#panel details[data-id]').forEach(function (d) {
        var id = d.getAttribute('data-id');
        if (id in abiertos) d.open = abiertos[id];
      });
      document.title = (estado.game ? etapaTexto(estado) + ' | ' : '') + 'Estrado';
    }
    actualizarReloj();
  }

  function actualizarReloj() {
    var el = $('reloj');
    if (!el || !estado || !estado.timer) return;
    var t = TD.reloj(estado.timer);
    el.textContent = t.cumplido ? 'Tiempo orientativo cumplido' : t.texto + ' de ' + minutos(estado.timer.duration_seconds);
    el.classList.toggle('cumplido', t.cumplido);
  }

  // ------------------------------------------------------------------ acciones
  function textoConfirmacion(sig) {
    var s = estado;
    var selladas = s.teams.filter(function (t) { return t.response_status === 'received'; }).length;
    if (sig.phase === 'defense') {
      return '<p>Se cierra la decisión de la ' + esc(nombreRonda(s.round_id).toLowerCase()) + ' y las respuestas se hacen públicas.</p><p>Respuestas selladas: <strong>' + selladas +
        ' de 5</strong>. Los equipos sin respuesta obtendrán 0 en afirmación y acción.</p>';
    }
    if (sig.phase === 'confrontation') return '<p>Se cierra la ventana de objeciones (' + esc(s.objection_count) + ' recibidas). Ya no se podrán presentar ni cambiar.</p>';
    if (sig.phase === 'resolution') return '<p>Se calculan y publican automáticamente los resultados de la ' + esc(nombreRonda(s.round_id).toLowerCase()) + '.</p>';
    if (sig.phase === 'reveal' || (sig.phase === 'deliberation' && sig.round_id !== s.round_id)) {
      return '<p>Todos los equipos verán el contenido de la ' + esc(nombreRonda(sig.round_id).toLowerCase()) + '.</p>';
    }
    if (sig.phase === 'deliberation') return '<p>Se abre la ventana para que cada equipo selle su respuesta.</p>';
    if (sig.phase === 'objection') return '<p>Se abre la ventana de objeciones: una por equipo como máximo.</p>';
    if (sig.phase === 'closing') return '<p>Se pasa al cierre y se publica la clasificación final.</p>';
    return '<p>Pasar a la siguiente fase.</p>';
  }

  function avanzar() {
    var sig = estado.next_stage;
    if (!sig || ocupado) return;
    var esperado = estado.stage_index;
    TD.confirmar({ titulo: 'Avanzar a ' + etapaTexto(sig), cuerpoHtml: textoConfirmacion(sig), aceptar: 'Avanzar' }).then(function (ok) {
      if (!ok) return;
      ocupado = true;
      var b = $('boton-avanzar');
      if (b) b.disabled = true;
      TD.enviarConReintentos('/api/moderator/advance', { expected_stage_index: esperado }).then(function (r) {
        ocupado = false;
        if (r.ok) $('mensaje').innerHTML = '';
        else aviso(r.status === 409 ? 'info' : 'error', TD.mensajeError(r));
        claveVista = '';
        iniciarSondeo();
      });
    });
  }

  function crear() {
    TD.enviarConReintentos('/api/moderator/game', {}).then(function (r) {
      if (r.ok) aviso('ok', 'Partida creada. Entregue a cada equipo su código.');
      else aviso('error', TD.mensajeError(r));
      iniciarSondeo();
    });
  }

  function reiniciar() {
    TD.confirmar({
      titulo: 'Reiniciar la partida',
      cuerpoHtml: '<p>La partida actual se <strong>archiva</strong> (queda guardada para auditoría) y se crea una nueva con <strong>códigos nuevos</strong>. Los teléfonos tendrán que volver a entrar.</p>' +
        '<label for="confirmacion-reinicio">Escriba REINICIAR para confirmar</label><input id="confirmacion-reinicio" type="text" autocomplete="off">',
      aceptar: 'Reiniciar',
      peligro: true,
      devolverEntrada: true,
    }).then(function (valor) {
      if (valor === false) return;
      TD.api('POST', '/api/moderator/reset', { confirm: String(valor).trim() }).then(function (r) {
        if (r.ok) aviso('ok', 'Partida reiniciada con códigos nuevos.');
        else aviso('error', TD.mensajeError(r));
        claveVista = '';
        iniciarSondeo();
      });
    });
  }

  function imprimir() {
    var zona = $('zona-impresion');
    zona.innerHTML = '<div class="contenedor"><h1 class="marca display"><span>Tribunal</span><span>Digital</span></h1>' +
      (estado.demo ? '<div class="cinta"><span>DEMO — DATOS FICTICIOS DE PRUEBA</span></div>' : '') +
      '<p class="acceso-texto">Abran en el teléfono la dirección que indica la moderación y escriban el código de su equipo.</p><div class="tarjetas-codigos">' +
      estado.teams.map(function (t) {
        return '<div class="tarjeta-codigo t-' + esc(t.id) + '"><span class="banca-nombre">Equipo ' + esc(t.name) + '</span><div class="codigo">' + esc(t.code) + '</div></div>';
      }).join('') + '</div></div>';
    document.body.classList.add('imprimiendo-codigos');
    window.addEventListener('afterprint', function fin() {
      document.body.classList.remove('imprimiendo-codigos');
      window.removeEventListener('afterprint', fin);
    });
    window.print();
  }

  $('panel').addEventListener('click', function (e) {
    var b = e.target.closest('[data-accion]');
    if (!b) return;
    var a = b.getAttribute('data-accion');
    if (a === 'avanzar') avanzar();
    if (a === 'crear') crear();
    if (a === 'reiniciar') reiniciar();
    if (a === 'imprimir') imprimir();
    if (a === 'salir') TD.api('POST', '/api/moderator/logout', {}).then(function () { mostrarAcceso(); });
  });

  setInterval(actualizarReloj, 1000);
  iniciarSondeo();
})();
