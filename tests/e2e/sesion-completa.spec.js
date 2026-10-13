// Ensayo completo con navegador real: cinco teléfonos (contextos distintos y
// simultáneos), moderación en escritorio y proyector 16:9. Todas las decisiones
// se toman pulsando la interfaz; la API solo se lee para orquestar y comprobar.
import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const PASSWORD = process.env.E2E_MODERATOR_SECRET;
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PLAN = JSON.parse(readFileSync(path.join(ROOT, 'fixtures', 'demo', 'simulation.json'), 'utf8'));
const SHOTS = path.join(ROOT, 'test-results', 'capturas');
const ROUNDS = ['R1', 'R2', 'R3', 'R4', 'FINAL'];
const TEAMS = ['azul', 'rojo', 'verde', 'amarillo', 'morado'];
// Teléfonos representativos (anchos de 360 a 412 px).
const PHONES = {
  azul: { width: 390, height: 844 },
  rojo: { width: 393, height: 851 },
  verde: { width: 360, height: 780 },
  amarillo: { width: 412, height: 915 },
  morado: { width: 375, height: 667 },
};
const signo = (n) => (n > 0 ? `+${n}` : String(n));

test('sesión completa: tutorial, R1–R4, final, cierre y auditoría', async ({ browser, baseURL }) => {
  mkdirSync(SHOTS, { recursive: true });

  // ---------------------------------------------------------------- moderación
  const modCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const mod = await modCtx.newPage();
  await mod.goto('/moderador');
  await expect(mod.locator('#cinta')).toHaveText('DEMO — DATOS FICTICIOS DE PRUEBA');
  await mod.fill('#clave', `${PASSWORD}-no`);
  await mod.click('#form-acceso button');
  await expect(mod.locator('#error-acceso')).toContainText('incorrecta');
  await mod.fill('#clave', PASSWORD);
  await mod.click('#form-acceso button');
  await mod.click('[data-accion="crear"]');
  await expect(mod.locator('#fase-actual')).toHaveText('Tutorial');
  const codes = {};
  for (const t of (await (await mod.request.get('/api/moderator/state')).json()).teams) codes[t.id] = t.code;
  await expect(mod.locator('.bancada-codigo').first()).toHaveText(codes.azul);

  const modState = async () => (await mod.request.get('/api/moderator/state')).json();
  async function avanzarUI() {
    const antes = (await modState()).stage_index;
    await mod.click('#boton-avanzar');
    await mod.click('#dialogo-aceptar');
    await expect.poll(async () => (await modState()).stage_index).toBe(antes + 1);
    await expect(mod.locator(`#panel[data-etapa="${antes + 1}"]`)).toBeVisible();
  }
  async function avanzarHasta(roundId, phase) {
    for (let i = 0; i < 40; i++) {
      const s = await modState();
      if (s.round_id === roundId && s.phase === phase) return s;
      await avanzarUI();
    }
    throw new Error(`no se llegó a ${roundId}/${phase}`);
  }

  // ---------------------------------------------------------------- proyector 16:9
  const projCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await projCtx.addCookies((await modCtx.cookies()).filter((c) => c.name === 'td_mod'));
  const proj = await projCtx.newPage();
  await proj.goto('/projection');
  await expect(proj).toHaveURL(/\/projection\/$/);
  await expect(proj.locator('#conexion')).toContainText('OK');
  await expect(proj.locator('#origen')).toHaveText(new URL(baseURL).origin);

  // ---------------------------------------------------------------- cinco teléfonos simultáneos
  const phones = {};
  for (const t of TEAMS) {
    const ctx = await browser.newContext({ viewport: PHONES[t], isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    phones[t] = await ctx.newPage();
  }
  await Promise.all(TEAMS.map(async (t) => {
    const p = phones[t];
    await p.goto('/');
    await expect(p.locator('#cinta')).toBeVisible();
    await p.fill('#codigo', codes[t].toLowerCase());
    await p.click('#form-acceso button');
    await expect(p.locator('#banda-equipo')).toHaveText(new RegExp(`Equipo`));
    await expect(p.locator('.reglas')).toBeVisible();
  }));
  await phones.azul.screenshot({ path: path.join(SHOTS, 'telefono-tutorial.png'), fullPage: true });

  // Un código de equipo no abre la proyección.
  const denegada = await phones.verde.request.get('/projection/');
  expect(denegada.status()).toBe(403);
  expect(await denegada.text()).not.toContain('demo-r1-reveal');

  async function sellar(team, r) {
    const p = phones[team];
    await expect(p.locator('#form-respuesta')).toBeVisible();
    await expect(p.locator('#boton-sellar')).toBeDisabled();
    await p.check(`input[name="claim"][value="${r.claim_id}"]`);
    for (const e of r.evidence_ids) await p.check(`input[name="evidence"][value="${e}"]`);
    if (r.evidence_ids.length === 2) {
      // Con dos evidencias, el resto queda bloqueado.
      const libres = p.locator('input[name="evidence"]:not(:checked)');
      if (await libres.count()) await expect(libres.first()).toBeDisabled();
    }
    await p.check(`input[name="action"][value="${r.action_id}"]`);
    await expect(p.locator('#boton-sellar')).toBeEnabled();
    await p.click('#boton-sellar');
    await expect(p.locator('#dialogo')).toBeVisible();
    await p.click('#dialogo-aceptar');
    await expect(p.locator('.sellada h2')).toHaveText('Respuesta sellada');
  }

  async function objetar(team, o) {
    const p = phones[team];
    await expect(p.locator('#form-objecion')).toBeVisible();
    await p.click(`.banca.t-${o.target_team_id}`);
    await p.check(`input[name="kind"][value="${o.objection_kind}"]`);
    await p.check(`input[name="cited"][value="${o.cited_evidence_id}"]`);
    await p.click('#boton-objetar');
    await p.click('#dialogo-aceptar');
    await expect(p.locator('.sellada h2')).toHaveText('Objeción presentada');
  }

  for (const rid of ROUNDS) {
    const rp = PLAN.rounds[rid];
    await avanzarHasta(rid, 'deliberation');

    if (rid === 'R2') {
      // Reconexión: recargar el teléfono a mitad de la decisión conserva la sesión.
      await phones.azul.reload();
      await expect(phones.azul.locator('#form-respuesta')).toBeVisible();
    }
    if (rid === 'R3') {
      // Red caída al sellar: el envío se reintenta solo y entra una única vez.
      const p = phones.rojo;
      const r = rp.responses.rojo;
      await p.check(`input[name="claim"][value="${r.claim_id}"]`);
      for (const e of r.evidence_ids) await p.check(`input[name="evidence"][value="${e}"]`);
      await p.check(`input[name="action"][value="${r.action_id}"]`);
      await p.context().setOffline(true);
      await p.click('#boton-sellar');
      await p.click('#dialogo-aceptar');
      await p.waitForTimeout(2500);
      await p.context().setOffline(false);
      await expect(p.locator('.sellada h2')).toHaveText('Respuesta sellada', { timeout: 15_000 });
    }

    // Las respuestas se sellan a la vez desde todos los teléfonos.
    await Promise.all(Object.entries(rp.responses)
      .filter(([t]) => !(rid === 'R3' && t === 'rojo'))
      .map(([t, r]) => sellar(t, r)));
    if (rid === 'R1') {
      await phones.rojo.screenshot({ path: path.join(SHOTS, 'telefono-sellada.png') });
      await expect(mod.locator('.estado-sellada')).toHaveCount(5);
      await mod.screenshot({ path: path.join(SHOTS, 'moderacion-decision.png'), fullPage: true });
    }

    await avanzarHasta(rid, 'defense');
    await expect(proj.locator('#respuestas li')).toHaveCount(5);
    for (const t of TEAMS) {
      if (!rp.responses[t]) await expect(phones[t].locator('.indicacion', { hasText: 'no selló respuesta' })).toBeVisible();
    }

    await avanzarHasta(rid, 'objection');
    if (rid === 'R4') {
      // Sin fichas: la interfaz lo explica y no ofrece el formulario.
      await expect(phones.azul.locator('.indicacion', { hasText: 'No les quedan fichas' })).toBeVisible();
      await expect(phones.azul.locator('#form-objecion')).toHaveCount(0);
    }
    await Promise.all(Object.entries(rp.objections ?? {}).map(([t, o]) => objetar(t, o)));
    if (rid === 'R1') await phones.verde.screenshot({ path: path.join(SHOTS, 'telefono-objecion.png'), fullPage: true });

    await avanzarHasta(rid, 'confrontation');
    await expect(proj.locator('#objeciones li')).toHaveCount(Object.keys(rp.objections ?? {}).length || 1);

    await avanzarHasta(rid, 'resolution');
    for (const t of TEAMS) {
      await expect(proj.locator(`#marcador tr[data-team="${t}"] .puntos`)).toHaveText(String(rp.expected.totals[t]));
      await expect(proj.locator(`#marcador tr[data-team="${t}"] .fichas`)).toHaveText(String(rp.expected.tokens[t]));
      await expect(phones[t].locator('.total-ronda .num')).toHaveText(signo(rp.expected.round_points[t]));
    }
    if (rid === 'R1') {
      await phones.azul.screenshot({ path: path.join(SHOTS, 'telefono-resultados.png'), fullPage: true });
      await proj.screenshot({ path: path.join(SHOTS, 'proyector-16x9-resultados.png') });
      await mod.screenshot({ path: path.join(SHOTS, 'moderacion-resultados.png'), fullPage: true });
    }
  }

  // Cambios de fase rápidos y autorizados: dos avances simultáneos sobre la misma fase → uno solo.
  const s0 = await modState();
  const dobles = await mod.evaluate(async (idx) => Promise.all([0, 1].map(() => fetch('/api/moderator/advance', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expected_stage_index: idx }),
  }).then((r) => r.status))), s0.stage_index);
  expect(dobles.sort()).toEqual([200, 409]);

  await avanzarHasta(null, 'closing');
  const ef = PLAN.expected_final;
  for (const t of TEAMS) {
    await expect(proj.locator(`#marcador tr[data-team="${t}"] .puntos`)).toHaveText(String(ef.scores[t]));
  }
  await expect(proj.locator('#ganadores')).toHaveText('Ganador(es): Azul y Rojo');
  await expect(phones.verde.locator('.ganadores p')).toHaveText('Victoria conjunta.');
  await phones.verde.screenshot({ path: path.join(SHOTS, 'telefono-cierre.png'), fullPage: true });
  await proj.screenshot({ path: path.join(SHOTS, 'proyector-16x9-cierre.png') });
  await mod.screenshot({ path: path.join(SHOTS, 'moderacion-cierre.png'), fullPage: true });

  // Exportación de auditoría desde el panel.
  const [descarga] = await Promise.all([mod.waitForEvent('download'), mod.click('a[href="/api/moderator/export.json"]')]);
  const exportado = JSON.parse(readFileSync(await descarga.path(), 'utf8'));
  expect(exportado.content_mode).toBe('demo');
  expect(exportado.winners.sort()).toEqual(['azul', 'rojo']);
  expect(exportado.score_events.filter((e) => e.points > 0).every((e) => e.rule_ref)).toBe(true);
  const [csv] = await Promise.all([mod.waitForEvent('download'), mod.click('a[href="/api/moderator/export.csv"]')]);
  expect(readFileSync(await csv.path(), 'utf8')).toContain('clasificacion');
});
