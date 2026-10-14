import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPublic } from '../../content/tools/build-public.mjs';

const content = buildPublic();
const sentences = new Intl.Segmenter('es', { granularity: 'sentence' });

test('cada opción del caso es una frase corta y cada evidencia tiene un resumen neutral', () => {
  for (const round of content.rounds) {
    for (const option of [...round.claims, ...round.actions, ...round.evidence.map((e) => ({ id: e.id, text: e.summary }))]) {
      assert.equal([...sentences.segment(option.text)].length, 1, `${option.id}: debe tener una sola frase`);
      assert.ok(option.text.trim().split(/\s+/).length <= 24, `${option.id}: supera las 24 palabras`);
      assert.doesNotMatch(option.text, /[\n\u2014]/, `${option.id}: no debe incluir párrafos ni rayas largas`);
    }
    for (const evidence of round.evidence) {
      assert.ok(evidence.summary.length <= 80, `${evidence.id}: resumen demasiado largo`);
      assert.ok(evidence.body.length > evidence.summary.length, `${evidence.id}: debe conservar la transcripción completa`);
    }
    assert.ok(round.title.length < 30, `${round.id}: el título debe ser corto`);
    assert.ok(round.question.startsWith('¿') && round.question.endsWith('?'));
  }
});

test('el paquete público generado coincide con los textos del caso', () => {
  const saved = JSON.parse(readFileSync(new URL('../../content/public.json', import.meta.url), 'utf8'));
  assert.deepEqual(saved, content, 'regenerar content/public.json tras cambiar la fuente del caso');
});
