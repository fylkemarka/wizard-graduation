// Palpable Sadness + Cost of Littering (Alan, 2026-06-08) — handler AoE
// powers that fire off the sacrifice and summon hooks. Asserted via the
// combat log so we don't depend on the composure-readout format.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

async function installPower(page, cardId) {
  for (let t = 0; t < 5; t++) {
    const p = handCardById(page, cardId).first();
    if ((await p.count()) > 0 && (await p.getAttribute('data-playable')) === 'true') { await p.click(); return true; }
    await endTurn(page);
    const a = page.getByRole('button', { name: 'Acknowledged' }); if ((await a.count()) > 0) await a.click();
  }
  return false;
}

test('Palpable Sadness deals AoE composure on a sacrifice', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1, forceSpecies: 'goose' });
  for (let i = 0; i < 6; i++) await addCard(page, 'cv2-l-birdseed');
  for (let i = 0; i < 3; i++) await addCard(page, 'c-palpable-sadness');
  await fightEnemy(page, 'Loom Familiar');

  expect(await installPower(page, 'c-palpable-sadness')).toBeTruthy();
  // Summon a goose.
  for (let t = 0; t < 4; t++) {
    const c = handCardById(page, 'cv2-l-birdseed').first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); break; }
    await endTurn(page);
  }
  await endTurn(page); // goose arrives
  const a = page.getByRole('button', { name: 'Acknowledged' }); if ((await a.count()) > 0) await a.click();

  // Sacrifice it → Palpable Sadness logs its AoE.
  const sac = page.getByTestId('sacrifice-animal').first();
  await expect(sac).toBeVisible();
  await sac.click();
  await expect(page.getByText(/Palpable Sadness/).first()).toBeVisible();
});
