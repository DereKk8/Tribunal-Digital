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
  test(`historia, archivo de pistas e imágenes completas en teléfono de ${width}px`, async ({ browser }) => {
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
      const archive = page.locator('#archivo-pistas');
      async function consultarArchivo(round) {
        await page.click('#boton-pistas');
        await expect(archive).toBeVisible();
        await expect(archive.locator('.pista')).toHaveCount(released);
        await expect(archive.locator('.transcripcion')).toHaveCount(0);
        if (round) {
          const group = archive.locator(`[data-lectura="ronda-${round.id}"]`);
          if (!(await group.getAttribute('open')) && (await group.getAttribute('open')) !== '') await group.locator(':scope > summary').click();
          await expect(group.locator('.contexto-caso p')).toHaveText(round.context);
          for (const e of round.evidence) {
            const card = group.locator(`#pista-${e.id}`);
            await expect(card.locator('h3')).toHaveText(e.title);
            await expect(card.locator('.pista-resumen')).toHaveText(e.summary);
            await expect(card.locator('.pista-datos li')).toHaveText(e.facts);
          }
          expect(await group.innerText()).not.toMatch(/RaiCoach_ATL|rf_coach|@rai|LeoNova14/);
        } else await expect(archive.locator('.contexto-caso p')).toHaveText(content.introduction);
        await page.click('#cerrar-pistas');
      }
      await consultarArchivo();

      for (const round of content.rounds) {
        released += round.evidence.length;
        if (round.id !== 'FINAL') {
          await advanceTo(game.mod, round.id, 'reveal');
          await expect(page.locator('.ronda-titulo')).toHaveText(round.title);
          await expect(page.locator('#contenido > .exhibiciones > .exhibicion')).toHaveCount(round.evidence.length);
          await expect(page.locator('#contenido > .contexto-caso p')).toHaveText(round.context);
          await expect(page.locator('#contenido .lista-lectura')).toHaveCount(0);
          await consultarArchivo(round);
        }
        await advanceTo(game.mod, round.id, 'deliberation');
        await expect(page.locator('.ronda-titulo')).toHaveText(round.title);
        await expect(page.locator('#form-respuesta')).toBeVisible();
        await expect(page.locator('.ronda-pregunta')).toHaveText(round.question);
        await expect(page.locator('#contenido > .contexto-caso p')).toHaveText(round.context);
        await expect(page.locator('input[name="evidence"]')).toHaveCount(released);
        expect(await page.evaluate(() => document.getElementById('banda').getBoundingClientRect().bottom <= document.querySelector('.ronda-cabecera').getBoundingClientRect().top + 1)).toBe(true);

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
        await page.click(`#form-respuesta [data-evidence="${evidence.id}"]`);
        await expect(archive).toBeVisible();
        await expect(archive.locator(`#pista-${evidence.id} .pista-resumen`)).toHaveText(evidence.summary);
        await page.click('#cerrar-pistas');
        await expect(page.locator('input[name="evidence"]:checked')).toHaveCount(0);
        await page.check(`input[name="claim"][value="${round.claims[0].id}"]`);
        await page.check(`input[name="evidence"][value="${evidence.id}"]`);
        await page.check(`input[name="evidence"][value="${round.evidence[1].id}"]`);
        await expect(page.locator('input[name="evidence"]:not(:checked)').first()).toBeDisabled();
        await page.check(`input[name="action"][value="${round.actions[0].id}"]`);
        await page.click('#boton-sellar');
        const dialog = page.locator('#dialogo');
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('.transcripcion')).toHaveCount(0);
        expect((await dialog.innerText()).length).toBeLessThan(700);
        await page.click('#dialogo-cancelar');
        await expect(page.locator('input[name="evidence"]:checked')).toHaveCount(2);
        await page.uncheck(`input[name="evidence"][value="${round.evidence[1].id}"]`);
        if (round.id !== 'R1') {
          const previous = page.locator('#pistas-anteriores-respuesta');
          await expect(previous).not.toHaveAttribute('open', '');
          await previous.locator(':scope > summary').click();
          const oldInput = previous.locator('input[name="evidence"]').first();
          await oldInput.check();
          await expect(page.locator('#anteriores-elegidas')).toHaveText(' · 1 elegida');
          await previous.locator(':scope > summary').click();
          await consultarArchivo(round);
          await expect(oldInput).toBeChecked();
          await previous.locator(':scope > summary').click();
          await oldInput.uncheck();
        }
        await page.click('#boton-sellar');
        await page.click('#dialogo-aceptar');
        await expect(page.locator('.sellada h2')).toHaveText('Respuesta sellada');
        await expect(page.locator(`.sellada [data-evidence="${evidence.id}"]`)).toBeVisible();
        await consultarArchivo(round);

        await game.teams.rojo.post('/api/team/response', {
          round_id: round.id, claim_id: round.claims[0].id, evidence_ids: [evidence.id], action_id: round.actions[0].id,
        });
        await advanceTo(game.mod, round.id, 'defense');
        await expect(page.locator('#banda-nombre')).toHaveText('Argumentos públicos');
        await consultarArchivo(round);
        await advanceTo(game.mod, round.id, 'objection');
        await expect(page.locator('#form-objecion')).toBeVisible();
        await expect(page.locator('input[name="cited"]')).toHaveCount(released);
        await page.check('input[name="target"][value="rojo"]');
        await page.check('input[name="kind"][value="contradiction"]');
        await page.check(`input[name="cited"][value="${evidence.id}"]`);
        // El sondeo periódico no debe interrumpir la lectura ni borrar la selección.
        await page.waitForResponse((response) => response.url().endsWith('/api/team/state'));
        await consultarArchivo(round);
        await expect(page.locator(`input[name="cited"][value="${evidence.id}"]`)).toBeChecked();
        await advanceTo(game.mod, round.id, 'confrontation');
        await expect(page.locator('#banda-nombre')).toHaveText('Confrontación oral');
        await consultarArchivo(round);
        await advanceTo(game.mod, round.id, 'resolution');
        await expect(page.locator('.total-ronda .num')).toHaveText('+5');
        await consultarArchivo(round);
      }
      await advanceTo(game.mod, null, 'closing');
      await expect(page.locator('#banda-nombre')).toHaveText('Cierre');
      await consultarArchivo(content.rounds.at(-1));
      // Las 18 imágenes caben enteras y mantienen su proporción, también al ampliarlas.
      await page.click('#boton-pistas');
      for (const round of content.rounds) {
        const group = archive.locator(`[data-lectura="ronda-${round.id}"]`);
        if ((await group.getAttribute('open')) === null) await group.locator(':scope > summary').click();
        for (const e of round.evidence) {
          const card = archive.locator(`#pista-${e.id}`);
          await card.locator('.captura-evidencia summary').click();
          const image = card.locator('img');
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(el => el.decode());
          const size = await image.evaluate(el => {
            const box = el.getBoundingClientRect(), parent = el.parentElement.getBoundingClientRect();
            return { ratio: box.height / box.width, naturalRatio: el.naturalHeight / el.naturalWidth, within: box.left >= parent.left - 1 && box.right <= parent.right + 1, fit: getComputedStyle(el).objectFit };
          });
          expect(size.ratio).toBeCloseTo(size.naturalRatio, 2);
          expect(size.within).toBe(true);
          expect(size.fit).toBe('contain');
          await card.locator('[data-image]').click();
          const viewer = page.locator('#visor-captura');
          await expect(viewer).toBeVisible();
          await viewer.locator('img').evaluate(el => el.decode());
          expect(await viewer.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
          expect(await viewer.locator('img').evaluate(el => getComputedStyle(el).objectFit)).toBe('contain');
          if (e.id === 'E14') await page.screenshot({ path: path.join(screenshots, `complete-image-${width}.png`) });
          await page.click('#cerrar-captura');
          await expect(archive).toBeVisible();
        }
      }
      await page.click('#cerrar-pistas');
      expect(errors).toEqual([]);
    } finally {
      await context?.close();
      await server.close();
      rmSync(temp, { recursive: true, force: true });
    }
  });
}
