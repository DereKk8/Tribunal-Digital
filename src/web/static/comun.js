/* Tribunal Digital — utilidades compartidas por las pantallas de equipo y moderación. */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** Llamada a la API. Nunca lanza: devuelve {ok, status, data, red}. red=true si falló la conexión. */
  function api(method, path, body) {
    var opts = { method: method, credentials: 'same-origin', cache: 'no-store', headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        return { ok: r.ok, status: r.status, data: data, red: false };
      });
    }).catch(function () {
      return { ok: false, status: 0, data: {}, red: true };
    });
  }

  /** Envía con reintentos ante fallos de red (el servidor es idempotente). */
  function enviarConReintentos(path, body, intentos) {
    intentos = intentos || 6;
    return api('POST', path, body).then(function (r) {
      if (r.red && intentos > 1) {
        return new Promise(function (res) { setTimeout(res, 1200); }).then(function () {
          return enviarConReintentos(path, body, intentos - 1);
        });
      }
      return r;
    });
  }

  function mensajeError(r) {
    if (r.red) return 'No hay conexión con el servidor. Comprueben la Wi-Fi y vuelvan a intentarlo.';
    return (r.data && r.data.error && r.data.error.message) || ('Error ' + r.status);
  }

  /** Temporizador orientativo: corrige el desfase de reloj con server_time. */
  var desfase = 0;
  function sincronizarReloj(timer) {
    if (timer && timer.server_time) desfase = Date.parse(timer.server_time) - Date.now();
  }
  function reloj(timer) {
    if (!timer || !timer.ends_at) return { texto: '', fraccion: 0, cumplido: false };
    var total = timer.duration_seconds || 1;
    var restante = Math.round((Date.parse(timer.ends_at) - (Date.now() + desfase)) / 1000);
    if (restante <= 0) return { texto: 'Tiempo cumplido', fraccion: 0, cumplido: true };
    var m = Math.floor(restante / 60);
    var s = restante % 60;
    return { texto: m + ':' + (s < 10 ? '0' : '') + s, fraccion: Math.min(1, restante / total), cumplido: false };
  }

  /** Diálogo de confirmación accesible. Devuelve una promesa con true/false (o el texto escrito). */
  function confirmar(opciones) {
    var dlg = document.getElementById('dialogo');
    document.getElementById('dialogo-titulo').textContent = opciones.titulo;
    document.getElementById('dialogo-cuerpo').innerHTML = opciones.cuerpoHtml;
    var ok = document.getElementById('dialogo-aceptar');
    var no = document.getElementById('dialogo-cancelar');
    ok.textContent = opciones.aceptar || 'Confirmar';
    no.textContent = opciones.cancelar || 'Volver';
    ok.className = opciones.peligro ? 'lacre' : '';
    var entrada = dlg.querySelector('input');
    return new Promise(function (resolve) {
      function cerrar(valor) {
        ok.removeEventListener('click', alAceptar);
        no.removeEventListener('click', alCancelar);
        dlg.removeEventListener('cancel', alCancelar);
        if (dlg.open) dlg.close();
        resolve(valor);
      }
      function alAceptar() { cerrar(opciones.devolverEntrada && entrada ? entrada.value : true); }
      function alCancelar(e) { if (e) e.preventDefault(); cerrar(false); }
      ok.addEventListener('click', alAceptar);
      no.addEventListener('click', alCancelar);
      dlg.addEventListener('cancel', alCancelar);
      dlg.showModal();
      (entrada || no).focus();
    });
  }

  /** Aplica anchos y variables que la CSP no permite escribir como atributo style. */
  function aplicarMedidas(raiz) {
    raiz.querySelectorAll('[data-pct]').forEach(function (el) { el.style.width = el.getAttribute('data-pct') + '%'; });
    raiz.querySelectorAll('[data-dur]').forEach(function (el) { el.style.setProperty('--dur', el.getAttribute('data-dur')); });
  }

  /** Marca DEMO visible antes de iniciar sesión. */
  function comprobarDemo(id) {
    api('GET', '/api/health').then(function (r) {
      if (r.ok && r.data.demo) document.getElementById(id).hidden = false;
    });
  }

  window.TD = {
    esc: esc,
    api: api,
    enviarConReintentos: enviarConReintentos,
    mensajeError: mensajeError,
    sincronizarReloj: sincronizarReloj,
    reloj: reloj,
    confirmar: confirmar,
    aplicarMedidas: aplicarMedidas,
    comprobarDemo: comprobarDemo,
  };
})();
