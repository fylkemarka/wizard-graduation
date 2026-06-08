// The Significant Pause (Alan bug, 2026-06-08): it grants +1 Energy at the
// start of every turn, but the player block read 4/3 instead of 4/4 — the
// per-turn gain is a raised ceiling, so the max must move too.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const PAUSE = 'p-significant-pause';

test('The Significant Pause raises the energy ceiling (4/4, not 4/3)', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 4 });
  await addCard(page, PAUSE);
  await fightEnemy(page, 'Silk Wraith');

  // Install the power (costs 3 — play it on a fresh turn with full energy).
  let installed = false;
  for (let t = 0; t < 6 && !installed; t++) {
    const c = handCardById(page, PAUSE).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); installed = true; break; }
    await endTurn(page);
    const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click();
  }
  expect(installed).toBeTruthy();

  // End the turn so the start-of-turn tick refills energy to the new ceiling.
  await endTurn(page);
  const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click();

  const energy = page.getByTestId('player-energy');
  await expect(energy).toHaveAttribute('data-energy', '4');
  await expect(energy).toHaveAttribute('data-energy-max', '4'); // ceiling moved → 4/4
});
