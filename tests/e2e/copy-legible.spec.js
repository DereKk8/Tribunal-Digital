// Usa los textos y las evidencias del caso con puntuación sintética y temporal;
// no requiere ni consulta la clave privada del taller.
import { test, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startApp, setupGame, advanceTo, ROOT } from '../helpers.js';

const content = JSON.parse(readFileSync(path.join(ROOT, 'content/public.json'), 'utf8'));
const screenshots = path.join(ROOT, 'test-results', 'copy-review');

for (const width of [360, 390]) {
  test(`texto legible y evidencia desplegable en teléfono de ${width}px`, async ({ browser }) => {
    const temp = mkdtempSync(path.join(os.tmpdir(), 'tribunal-copy-test-'));
    const keyPath = path.join(temp, 'synthetic-key.json');
    // La primera opción se acepta solo para ejercitar la UI, sin inferir respuestas reales.
    writeFileSync(keyPath, JSON.stringify({
      schema_version: content.schema_version,
      game_id: content.game_id,
      rounds: Object.fromEntries(content.rounds.map((r) => [r.id, {
        accepted_arguments: [{ claim_id: r.claims[0].id, evidence_ids: [r.evidence[0].id] }],
        accepted_actions: [r.actions[0].id],
        accepted_objections: [],
      }])),
    }));
    const server = await startApp({ mode: 'real', env: { ANSWER_KEY_PATH: keyPath } });
    let context;
    try {
      const game = await setupGame(server.base);
      context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(server.base);
      await page.fill('#codigo', game.codes.azul);
      await page.click('#form-acceso button');
      await expect(page.locator('.reglas')).toBeVisible();
      await expect(page.locator('#banda-equipo')).toHaveText('Equipo Azul');
      mkdirSync(screenshots, { recursive: true });
      let released = 0;

      for (const round of content.rounds) {
        released += round.evidence.length;
        if (round.id !== 'FINAL') {
          await advanceTo(game.mod, round.id, 'reveal');
          await expect(page.locator('.ronda-titulo')).toHaveText(round.title);
          await expect(page.locator('#contenido > .exhibiciones > .exhibicion')).toHaveCount(round.evidence.length);
          await expect(page.locator('.lectura-evidencia[open]')).toHaveCount(0);
        }
        await advanceTo(game.mod, round.id, 'deliberation');
        await expect(page.locator('.ronda-titulo')).toHaveText(round.title);
        await expect(page.locator('#form-respuesta')).toBeVisible();
        await expect(page.locator('.ronda-pregunta')).toHaveText(round.question);
        await expect(page.locator('input[name="evidence"]')).toHaveCount(released);

        const stats = await page.evaluate(() => ({
          height: document.documentElement.scrollHeight,
          chars: document.querySelector('#form-respuesta').innerText.length,
          overflow: document.documentElement.scrollWidth > innerWidth,
          labels: [...document.querySelectorAll('.opcion')].map((el) => ({
            height: el.getBoundingClientRect().height,
            chars: el.innerText.length,
          })),
        }));
        expect(stats.overflow).toBe(false);
        expect(stats.height).toBeLessThan(6000);
        expect(stats.chars).toBeLessThan(3300);
        expect(stats.labels.every((label) => label.height < 250 && label.chars < 180)).toBe(true);
        if (width === 390) console.log(`${round.id}: ${stats.chars} caracteres, ${stats.height}px de alto`);
        await page.screenshot({ path: path.join(screenshots, `after-${round.id.toLowerCase()}-${width}.png`), fullPage: true });

        // Abrir y leer no selecciona una prueba; el límite de dos sigue vigente.
        const evidence = round.evidence[0];
        const reader = page.locator(`#form-respuesta details[data-lectura="${evidence.id}"]`);
        await reader.locator('summary').click();
        await expect(reader).toHaveAttribute('open', '');
        await expect(reader.locator('.transcripcion')).toHaveText(evidence.body.split('\n').join(''));
        await expect(page.locator('input[name="evidence"]:checked')).toHaveCount(0);
        await page.check(`input[name="claim"][value="${round.claims[0].id}"]`);
        await page.check(`input[name="evidence"][value="${evidence.id}"]`);
        await page.check(`input[name="evidence"][value="${round.evidence[1].id}"]`);
        await expect(page.locator('input[name="evidence"]:not(:checked)').first()).toBeDisabled();
        await reader.locator('summary').click();
        await page.check(`input[name="action"][value="${round.actions[0].id}"]`);
        await page.click('#boton-sellar');
        const dialog = page.locator('#dialogo');
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('.lectura-evidencia[open]')).toHaveCount(0);
        expect((await dialog.innerText()).length).toBeLessThan(700);
        await page.click('#dialogo-cancelar');
        await expect(page.locator('input[name="evidence"]:checked')).toHaveCount(2);
        await page.uncheck(`input[name="evidence"][value="${round.evidence[1].id}"]`);
        await page.click('#boton-sellar');
        await page.click('#dialogo-aceptar');
        await expect(page.locator('.sellada h2')).toHaveText('Respuesta sellada');
        await expect(page.locator(`.sellada details[data-lectura="${evidence.id}"]`)).toBeVisible();

        await game.teams.rojo.post('/api/team/response', {
          round_id: round.id, claim_id: round.claims[0].id, evidence_ids: [evidence.id], action_id: round.actions[0].id,
        });
        await advanceTo(game.mod, round.id, 'objection');
        await expect(page.locator('#form-objecion')).toBeVisible();
        await expect(page.locator('input[name="cited"]')).toHaveCount(released);
        const objectionReader = page.locator(`#form-objecion details[data-lectura="${evidence.id}"]`);
        await objectionReader.locator('summary').click();
        await page.check('input[name="target"][value="rojo"]');
        await page.check('input[name="kind"][value="contradiction"]');
        await page.check(`input[name="cited"][value="${evidence.id}"]`);
        // El sondeo periódico no debe interrumpir la lectura ni borrar la selección.
        await page.waitForResponse((response) => response.url().endsWith('/api/team/state'));
        await expect(objectionReader).toHaveAttribute('open', '');
        await expect(page.locator(`input[name="cited"][value="${evidence.id}"]`)).toBeChecked();
        await objectionReader.locator('summary').click();
        await advanceTo(game.mod, round.id, 'resolution');
        await expect(page.locator('.total-ronda .num')).toHaveText('+5');
      }
      expect(errors).toEqual([]);
    } finally {
      await context?.close();
      await server.close();
      rmSync(temp, { recursive: true, force: true });
    }
  });
}
