#!/usr/bin/env node
// Genera content/public.json a partir de content/src/case.mjs.
// Uso: node content/tools/build-public.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { GAME_ID, SCHEMA_VERSION, TEAMS, ROUNDS, EVIDENCE, claimId, actionId } from '../src/case.mjs';
import { evidenceBody } from '../src/evidence-text.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function buildPublic() {
  return {
    schema_version: SCHEMA_VERSION,
    game_id: GAME_ID,
    teams: TEAMS.map(({ id, name }) => ({ id, name })),
    rounds: ROUNDS.map((r) => ({
      id: r.id,
      title: r.name,
      question: r.question,
      evidence: EVIDENCE.filter((e) => e.round === r.id).map((e) => ({
        id: e.id,
        summary: e.summary,
        body: evidenceBody(e),
        asset_path: `assets/evidence/${e.id}.svg`,
        revealed_in: e.round,
      })),
      claims: r.claims.map((text, i) => ({ id: claimId(r.id, i), text })),
      actions: r.actions.map((text, i) => ({ id: actionId(r.id, i), text })),
    })),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.join(ROOT, 'content', 'public.json');
  writeFileSync(out, JSON.stringify(buildPublic(), null, 2) + '\n', 'utf8');
  console.log(`✓ Escrito ${path.relative(ROOT, out)}`);
}
