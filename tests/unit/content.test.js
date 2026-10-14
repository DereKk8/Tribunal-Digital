import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, unlinkSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadContent, ContentError } from '../../src/content/load.js';
import { contentPaths } from '../../src/config.js';
import { copyDemoPackage, mutate, tempDir, ROOT } from '../helpers.js';

function expectErrors(paths, ...fragments) {
  try {
    loadContent(paths);
  } catch (e) {
    assert.ok(e instanceof ContentError, `se esperaba ContentError y fue ${e}`);
    const all = e.errors.join('\n');
    for (const f of fragments) assert.ok(all.includes(f), `falta el diagnóstico «${f}» en:\n${all}`);
    return e.errors;
  }
  assert.fail('el paquete inválido se aceptó');
}

function withCopy(fn) {
  const { dir, paths } = copyDemoPackage();
  try {
    return fn(paths, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('importa el paquete DEMO válido', () => {
  const c = loadContent(contentPaths('demo', ROOT));
  assert.equal(c.mode, 'demo');
  assert.equal(c.teams.length, 5);
  assert.deepEqual(c.rounds.map((r) => r.id), ['R1', 'R2', 'R3', 'R4', 'FINAL']);
  assert.match(c.fingerprint, /^[0-9a-f]{64}$/);
  assert.deepEqual(c.warnings, []);
  assert.equal(c.rounds[0].question, null);
  assert.equal(c.rounds[0].evidence[0].summary, c.rounds[0].evidence[0].body, 'los paquetes anteriores conservan sus frases breves');
});

test('una transcripción larga sin resumen no se repite en la opción de selección', () => withCopy((p) => {
  mutate(p, ({ pub }) => { pub.rounds[0].evidence[0].body = 'Una primera frase.\nUna segunda frase.'; });
  const evidence = loadContent(p).rounds[0].evidence[0];
  assert.equal(evidence.summary, `Revisemos la evidencia ${evidence.id}.`);
  assert.equal(evidence.body, 'Una primera frase.\nUna segunda frase.');
}));

test('rechaza un esquema inválido (campo obligatorio ausente) con mensaje en español', () => withCopy((p) => {
  mutate(p, ({ pub }) => { delete pub.rounds[1].claims[0].text; });
  expectErrors(p, 'falta la propiedad obligatoria «text»');
}));

test('rechaza referencias rotas en la clave', () => withCopy((p) => {
  mutate(p, ({ key }) => { key.rounds.R1.accepted_arguments[0].claim_id = 'R1-C99'; });
  expectErrors(p, 'no pertenece a R1');
}));

test('rechaza una evidencia futura en la clave', () => withCopy((p) => {
  mutate(p, ({ key }) => { key.rounds.R1.accepted_arguments[0].evidence_ids = ['R2-E1']; });
  expectErrors(p, 'referencia al futuro');
}));

test('rechaza combinaciones de evidencias duplicadas o repetidas', () => withCopy((p) => {
  mutate(p, ({ key }) => {
    key.rounds.R1.accepted_arguments.push({ claim_id: 'R1-C4', evidence_ids: ['R1-E2', 'R1-E1'] });
    key.rounds.R2.accepted_arguments[0].evidence_ids = ['R2-E1', 'R2-E1'];
  });
  expectErrors(p, 'combinación repetida', 'evidencias repetidas');
}));

test('rechaza recursos inexistentes', () => withCopy((p, dir) => {
  unlinkSync(path.join(dir, 'assets', 'demo-r3-e2.svg'));
  expectErrors(p, 'no existe el recurso «assets/demo-r3-e2.svg»');
}));

test('rechaza rutas de recurso que salen de assets/', () => withCopy((p) => {
  mutate(p, ({ pub }) => { pub.rounds[0].evidence[0].asset_path = 'assets/../content/answer-key.private.json'; });
  expectErrors(p, 'ruta relativa segura');
}));

test('rechaza metadatos públicos/privados que no coinciden', () => withCopy((p) => {
  mutate(p, ({ key }) => { key.game_id = 'otro-juego'; });
  expectErrors(p, 'game_id');
}));

test('rechaza versión de esquema distinta de 1.0', () => withCopy((p) => {
  mutate(p, ({ pub }) => { pub.schema_version = '2.0'; });
  expectErrors(p, 'schema_version');
}));

test('rechaza IDs de equipos o rondas fuera del contrato', () => withCopy((p) => {
  mutate(p, ({ pub }) => { pub.teams[4].id = 'naranja'; pub.rounds[4].id = 'R5'; });
  expectErrors(p, 'faltan los equipos: morado', 'R1, R2, R3, R4, FINAL');
}));

test('rechaza IDs ambiguos (repetidos entre evidencias, afirmaciones y acciones)', () => withCopy((p) => {
  mutate(p, ({ pub }) => { pub.rounds[1].claims[0].id = 'R1-E1'; });
  expectErrors(p, 'identificador ambiguo «R1-E1»');
}));

test('rechaza revealed_in inválido o distinto de su ronda', () => withCopy((p) => {
  mutate(p, ({ pub }) => { pub.rounds[0].evidence[1].revealed_in = 'R3'; pub.rounds[1].evidence[0].revealed_in = 'R9'; });
  expectErrors(p, 'debe coincidir con la ronda que la contiene', '«revealed_in» inválido');
}));

test('rechaza listas vacías', () => withCopy((p) => {
  mutate(p, ({ pub, key }) => { pub.rounds[2].actions = []; key.rounds.R2.accepted_actions = []; });
  expectErrors(p, '«actions» debe ser una lista no vacía', '«accepted_actions» debe ser una lista no vacía');
}));

test('rechaza campos privados dentro de public.json', () => withCopy((p) => {
  mutate(p, ({ pub }) => { pub.rounds[0].accepted_actions = ['R1-A1']; });
  expectErrors(p, 'campo privado');
}));

test('rechaza un mapa de proyección con fases ausentes o diapositivas inexistentes', () => withCopy((p) => {
  mutate(p, ({ map }) => { delete map.rounds.R2.defense; map.rounds.R3.reveal = 'no-existe-en-el-html'; });
  expectErrors(p, 'R2: falta la fase «defense»', 'no existe en la proyección');
}));

test('rechaza un HTML de proyección que contiene datos de la clave', () => withCopy((p) => {
  const html = readFileSync(p.projectionHtmlPath, 'utf8').replace('</body>', '<script>const k={accepted_objections:[]}</script></body>');
  writeFileSync(p.projectionHtmlPath, html);
  expectErrors(p, 'proyección (index.html): contiene el marcador privado «accepted_objections»');
}));

test('detecta frases de rationales.private.md copiadas en la proyección', () => withCopy((p, dir) => {
  const frase = 'Esta justificación privada explica por qué la respuesta correcta es la tercera';
  writeFileSync(path.join(dir, 'rationales.private.md'), `# Notas\n${frase}.\n`);
  writeFileSync(p.projectionHtmlPath, readFileSync(p.projectionHtmlPath, 'utf8').replace('</body>', `<p>${frase}</p></body>`));
  expectErrors({ ...p, rationalesPath: path.join(dir, 'rationales.private.md') }, 'rationales.private.md');
}));

test('falla cerrado si falta la clave privada (sin usar otra de reemplazo)', () => withCopy((p) => {
  unlinkSync(p.keyPath);
  expectErrors(p, 'Falta el archivo de clave privada');
}));

test('modo real sin paquete de Agente A: falla con diagnóstico en español, sin caer al DEMO', () => {
  // Raíz vacía: la prueba no depende de si el repositorio ya tiene el paquete o la clave real instalados.
  const root = tempDir('tribunal-vacio-');
  try {
    const real = contentPaths('real', root);
    for (const k of ['publicPath', 'keyPath', 'schemaPath', 'projectionMapPath', 'projectionHtmlPath']) {
      assert.ok(real[k].startsWith(root), k);
      assert.ok(!real[k].includes('fixtures'), k);
    }
    const errors = expectErrors(real, 'Falta el archivo public.json', 'Falta el archivo de clave privada', 'Falta el archivo schema.json', 'Falta el archivo projection-map.json', 'Falta el archivo de proyección');
    assert.ok(!errors.some((m) => m.includes(path.join(ROOT, 'fixtures'))));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('JSON mal formado se informa con el nombre del archivo', () => withCopy((p) => {
  writeFileSync(p.keyPath, '{ "schema_version": ');
  expectErrors(p, 'clave privada: JSON inválido');
}));
