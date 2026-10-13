import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startApp, setupGame, advanceTo, PASSWORD, ROOT } from '../helpers.js';
import { crawlForLeaks, rawGet } from '../../scripts/lib/leak-crawl.js';

const WEB = path.join(ROOT, 'src', 'web');

test('recorrido completo (31 etapas) sin fugas de clave, evidencia futura ni archivos privados', async () => {
  const srv = await startApp();
  try {
    const { errors, stats } = await crawlForLeaks({ app: srv.app, password: PASSWORD, webDir: WEB });
    assert.deepEqual(errors, []);
    assert.equal(stats.stages, 31);
  } finally {
    await srv.close();
  }
});

test('control negativo: el recorrido SÍ detecta una fuga de la clave en el estado público', async () => {
  const srv = await startApp();
  try {
    const original = srv.app.service.getPublicState.bind(srv.app.service);
    srv.app.service.getPublicState = () => ({ ...original(), debug: srv.app.content.key.R1.accepted_objections.map((o) => ({ target_claim_id: o.target_claim_id })) });
    const { errors } = await crawlForLeaks({ app: srv.app, password: PASSWORD, webDir: WEB });
    assert.ok(errors.some((e) => e.includes('target_claim_id')), errors.join('\n'));
  } finally {
    await srv.close();
  }
});

test('control negativo: el recorrido SÍ detecta evidencia futura entregada a un equipo', async () => {
  const srv = await startApp();
  try {
    const svc = srv.app.service;
    svc.releasedEvidence = () => [...srv.app.content.evidenceById.values()];
    const { errors } = await crawlForLeaks({ app: srv.app, password: PASSWORD, webDir: WEB });
    assert.ok(errors.some((e) => e.includes('se filtra contenido futuro')), errors.slice(0, 5).join('\n'));
  } finally {
    await srv.close();
  }
});

test('rutas con «..» codificado o literal no salen de las carpetas permitidas', async () => {
  const srv = await startApp();
  try {
    const port = srv.app.server.address().port;
    for (const p of [
      '/static/../../package.json', '/static/%2e%2e/%2e%2e/package.json', '/static/..%2f..%2fpackage.json',
      '/projection/../fixtures/demo/content/answer-key.private.json', '/assets/..%2f..%2f.env',
      '/media/..%2f..%2fcontent%2fanswer-key.private.json', '/fixtures/demo/content/answer-key.private.json',
      '/static/%00app.css', '/static/..\\..\\package.json',
    ]) {
      const r = await rawGet(port, p);
      assert.notEqual(r.status, 200, p);
      assert.ok(!r.text.includes('accepted_'), p);
    }
  } finally {
    await srv.close();
  }
});

test('evidencias: el equipo solo descarga las reveladas; cabeceras de aislamiento en recursos', async () => {
  const srv = await startApp();
  try {
    const g = await setupGame(srv.base);
    assert.equal((await g.teams.azul.get('/media/R1-E1')).status, 404, 'tutorial: nada revelado');
    await advanceTo(g.mod, 'R1', 'reveal');
    const ok = await g.teams.azul.get('/media/R1-E1');
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'image/svg+xml');
    assert.match(ok.headers.get('content-security-policy'), /sandbox/);
    assert.equal((await g.teams.azul.get('/media/R2-E1')).status, 404);
    assert.equal((await g.teams.azul.get('/media/NO-EXISTE')).status, 404);
    assert.equal((await g.mod.get('/media/R2-E1')).status, 200, 'la moderación puede previsualizar');
  } finally {
    await srv.close();
  }
});
