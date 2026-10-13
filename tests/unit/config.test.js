import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveConfig, realModeSafetyChecks, ConfigError } from '../../src/config.js';
import { buildRealRoot, ROOT, randomSecret } from '../helpers.js';

const ENV = { MODERATOR_PASSWORD: randomSecret() };

test('sin CONTENT_MODE no arranca (no hay modo por defecto)', () => {
  assert.throws(() => resolveConfig({ argv: [], env: ENV }), (e) => e instanceof ConfigError && /CONTENT_MODE/.test(e.message));
});

test('modo inválido se rechaza', () => {
  assert.throws(() => resolveConfig({ argv: ['--modo=prueba'], env: ENV }), ConfigError);
});

test('la contraseña de moderación es obligatoria y de al menos 10 caracteres', () => {
  assert.throws(() => resolveConfig({ argv: ['--modo=demo'], env: {} }), /MODERATOR_PASSWORD/);
  assert.throws(() => resolveConfig({ argv: ['--modo=demo'], env: { MODERATOR_PASSWORD: randomSecret().slice(0, 5) } }), /MODERATOR_PASSWORD/);
});

test('modo demo usa SOLO fixtures/demo y avisa si se indica una clave externa', () => {
  const c = resolveConfig({ argv: ['--modo=demo'], env: { ...ENV, ANSWER_KEY_PATH: '/tmp/otra-clave.json' } });
  for (const k of ['publicPath', 'keyPath', 'schemaPath', 'projectionMapPath', 'projectionHtmlPath']) {
    assert.ok(c.content[k].startsWith(path.join(ROOT, 'fixtures', 'demo')), k);
  }
  assert.ok(c.warnings.some((w) => w.includes('ANSWER_KEY_PATH se ignora')));
});

test('modo real usa SOLO el paquete canónico y la clave indicada', () => {
  const c = resolveConfig({ argv: ['--modo=real'], env: { ...ENV, ANSWER_KEY_PATH: '/secretos/clave.json' } });
  assert.equal(c.content.publicPath, path.join(ROOT, 'content', 'public.json'));
  assert.equal(c.content.keyPath, '/secretos/clave.json');
  assert.equal(c.content.projectionHtmlPath, path.join(ROOT, 'projection', 'index.html'));
  for (const k of ['publicPath', 'keyPath', 'schemaPath', 'projectionMapPath', 'projectionHtmlPath']) assert.ok(!c.content[k].includes('fixtures'));
});

test('el argumento --modo tiene prioridad sobre CONTENT_MODE', () => {
  assert.equal(resolveConfig({ argv: ['--modo=real'], env: { ...ENV, CONTENT_MODE: 'demo' } }).mode, 'real');
});

test('modo real: rechaza un paquete que es copia del DEMO', () => {
  const root = buildRealRoot();
  try {
    const c = resolveConfig({ argv: ['--modo=real'], env: ENV, root });
    const errs = realModeSafetyChecks(c);
    assert.ok(errs.some((e) => e.includes('public.json es idéntico al DEMO')));
    assert.ok(errs.some((e) => e.includes('la clave privada es idéntico al DEMO')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('modo real: rechaza una clave real versionada en Git', () => {
  const root = buildRealRoot({ withDemoCopy: false });
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['add', 'content/answer-key.private.json'], { cwd: root });
    const c = resolveConfig({ argv: ['--modo=real'], env: ENV, root });
    const errs = realModeSafetyChecks(c);
    assert.ok(errs.some((e) => e.includes('está versionada en Git')), errs.join('\n'));
    // Sin versionar: sin errores.
    execFileSync('git', ['rm', '-q', '--cached', 'content/answer-key.private.json'], { cwd: root });
    writeFileSync(path.join(root, '.gitignore'), 'content/answer-key.private.json\n');
    assert.deepEqual(realModeSafetyChecks(c), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
