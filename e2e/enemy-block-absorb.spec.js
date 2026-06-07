// Enemy Block vs animal attacks (Alan's report, 2026-06-07: "animal
// attacks are bypassing enemy block"). The engine was CORRECT — block
// absorbs — but the instrumentation lied (composureDealt logs attempted
// damage; the fade log read a stale closure). This pins the truth:
// two forced geese (2×6) into a forced block-6 intent must drop enemy
// composure by exactly 6, and the Σ strip shows the −block chip.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

test('enemy block soaks animal attacks (and the strip says so)', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1, forceSpecies: 'goose' });
  for (let i = 0; i < 10; i++) await addCard(page, 'cv2-l-birdseed');
  await page.evaluate(() => { window.__forceIntentKind = 'block'; });
  await fightEnemy(page, 'Silk Wraith');

  const readComp = async () =>
    parseInt(await page.locator('[title^="Composure — drain"]').first().innerText(), 10);

  // T1: block telegraphed (forced); stage two geese.
  for (let p = 0; p < 2; p++) {
    const c = handCardById(page, 'cv2-l-birdseed').first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') await c.click();
  }
  await endTurn(page); // block resolves (+6); geese arrive
  await expect(page.getByTestId('hand')).toBeVisible();
  const compBefore = await readComp();

  // The projection strip warns about the block soak.
  await expect(page.getByText(/−/).filter({ hasText: '6' }).first()).toBeVisible();

  // T2: geese swing 12 into block 6 → exactly 6 lands.
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();
  expect(compBefore - (await readComp())).toBe(6);
});
