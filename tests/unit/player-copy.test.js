import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPublic } from '../../content/tools/build-public.mjs';

const content = buildPublic();
const sentences = new Intl.Segmenter('es', { granularity: 'sentence' });

test('las opciones son breves y las pistas explican hechos sin nombres de usuario', () => {
  for (const round of content.rounds) {
    for (const option of [...round.claims, ...round.actions, ...round.evidence.map((e) => ({ id: e.id, text: e.summary }))]) {
      assert.equal([...sentences.segment(option.text)].length, 1, `${option.id}: debe tener una sola frase`);
      assert.ok(option.text.trim().split(/\s+/).length <= 24, `${option.id}: supera las 24 palabras`);
      assert.doesNotMatch(option.text, /[\n\u2014]/, `${option.id}: no debe incluir párrafos ni rayas largas`);
    }
    for (const evidence of round.evidence) {
      assert.ok(evidence.summary.length <= 160, `${evidence.id}: resumen demasiado largo`);
      assert.ok(evidence.title && evidence.facts.length >= 1 && evidence.facts.length <= 4);
      for (const fact of evidence.facts) assert.ok(fact.split(/\s+/).length <= 24, `${evidence.id}: hecho demasiado largo`);
      assert.ok(evidence.body.length > evidence.summary.length, `${evidence.id}: debe conservar la transcripción completa`);
    }
    assert.ok(round.title.length < 30, `${round.id}: el título debe ser corto`);
    assert.ok(round.question.startsWith('¿') && round.question.endsWith('?'));
    assert.match(round.context, /Leo/);
    assert.match(round.context, /14 años/);
    assert.match(round.context, /Marina/);
    assert.match(round.context, /hermana/);
    assert.match(round.context, /torneo/);
    assert.match(round.context, /entrenador/);
    assert.ok(round.context.split(/\s+/).length <= 70, `${round.id}: contexto demasiado largo`);
    const visible = [round.context, ...round.claims.map(c => c.text), ...round.actions.map(a => a.text), ...round.evidence.flatMap(e => [e.title, e.summary, ...e.facts])].join(' ');
    assert.doesNotMatch(visible, /RaiCoach_ATL|rf_coach|@[a-z]|LeoNova14|DaniZurdo/);
  }
});

test('el paquete público generado coincide con los textos del caso', () => {
  const saved = JSON.parse(readFileSync(new URL('../../content/public.json', import.meta.url), 'utf8'));
  assert.deepEqual(saved, content, 'regenerar content/public.json tras cambiar la fuente del caso');
});
