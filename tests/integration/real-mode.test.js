import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildRealRoot, startApp, setupGame, advanceTo, readJson, writeJson, PASSWORD } from '../helpers.js';
import { ContentError } from '../../src/content/load.js';
import { StartupError } from '../../src/game/service.js';
import { crawlForLeaks } from '../../scripts/lib/leak-crawl.js';
import { ROOT } from '../../src/config.js';

// Paquete «real» SINTÉTICO (derivado del DEMO pero distinto): prueba la ruta de
// importación del modo real sin usar ni conocer la clave real del taller.
function makeSyntheticReal() {
  const root = buildRealRoot();
  const pubPath = path.join(root, 'content', 'public.json');
  const keyPath = path.join(root, 'content', 'answer-key.private.json');
  const pub = readJson(pubPath);
  pub.title = 'Paquete sintético para pruebas del modo real';
  pub.rounds.forEach((r) => { r.title = r.title.replace('DEMO — ', 'Prueba — '); });
  writeJson(pubPath, pub);
  const key = readJson(keyPath);
  delete key.aviso;
  key.rounds.R1.accepted_actions = ['R1-A1'];
  writeJson(keyPath, key);
  const html = readFileSync(path.join(root, 'projection', 'index.html'), 'utf8').replace('<title>', '<title>Prueba real · ');
  writeFileSync(path.join(root, 'projection', 'index.html'), html);
  return root;
}

test('modo real con un paquete válido: carga solo ese paquete, sin banner DEMO, base de datos separada', async () => {
  const root = makeSyntheticReal();
  try {
    const srv = await startApp({ mode: 'real', root });
    try {
      assert.ok(srv.config.dbFile.endsWith('tribunal-real.sqlite'));
      assert.equal(srv.app.content.mode, 'real');
      assert.equal(srv.app.content.paths.publicPath, path.join(root, 'content', 'public.json'));
      const pub = (await (await fetch(srv.base + '/api/public-state')).json());
      assert.equal(pub.demo, false);
      assert.equal(pub.demo_notice, null);
      assert.equal(pub.content_mode, 'real');
      const g = await setupGame(srv.base);
      await advanceTo(g.mod, 'R1', 'reveal');
      const st = (await g.teams.azul.get('/api/team/state')).data;
      assert.equal(st.round_title, 'Prueba — Verificación de horarios');
      // La proyección real se sirve sin cambios.
      const proj = await g.mod.get('/projection/');
      assert.equal(Buffer.compare(proj.body, readFileSync(path.join(root, 'projection', 'index.html'))), 0);
    } finally {
      await srv.close();
    }
    // Y el recorrido de fugas también pasa en modo real.
    const srv2 = await startApp({ mode: 'real', root });
    try {
      const { errors } = await crawlForLeaks({ app: srv2.app, password: PASSWORD, webDir: path.join(ROOT, 'src', 'web') });
      assert.deepEqual(errors, []);
    } finally {
      await srv2.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('modo real sin clave privada: falla cerrado y NO usa la clave DEMO', async () => {
  const root = makeSyntheticReal();
  try {
    unlinkSync(path.join(root, 'content', 'answer-key.private.json'));
    await assert.rejects(startApp({ mode: 'real', root }), (e) => {
      assert.ok(e instanceof ContentError);
      assert.ok(e.errors.some((m) => m.includes('Falta el archivo de clave privada') && m.includes(path.join(root, 'content'))));
      assert.ok(!e.errors.some((m) => m.includes('fixtures')));
      return true;
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('modo real con la clave indicada por ANSWER_KEY_PATH (fuera del repositorio)', async () => {
  const root = makeSyntheticReal();
  const external = path.join(root, '..', path.basename(root) + '-clave.json');
  try {
    writeFileSync(external, readFileSync(path.join(root, 'content', 'answer-key.private.json')));
    unlinkSync(path.join(root, 'content', 'answer-key.private.json'));
    const srv = await startApp({ mode: 'real', root, env: { ANSWER_KEY_PATH: external } });
    assert.equal(srv.app.content.paths.keyPath, external);
    await srv.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(external, { force: true });
  }
});

test('modo real con el paquete DEMO copiado: falla cerrado', async () => {
  const root = buildRealRoot();
  try {
    await assert.rejects(startApp({ mode: 'real', root }), (e) => e instanceof StartupError && /idéntico al DEMO/.test(e.message));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('modo real con un paquete roto: diagnóstico en español y sin arrancar', async () => {
  const root = makeSyntheticReal();
  try {
    const mapPath = path.join(root, 'content', 'projection-map.json');
    const map = readJson(mapPath);
    delete map.rounds.FINAL;
    writeJson(mapPath, map);
    await assert.rejects(startApp({ mode: 'real', root }), (e) => e instanceof ContentError && e.errors.some((m) => m.includes('FINAL')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
