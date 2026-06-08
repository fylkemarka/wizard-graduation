// Strays (Alan, 2026-06-08): a 1E card that drops two 1-turn fodder bodies
// into open slots — bodies for the sacrifice engine (sacrifice-for-Block,
// Memorial, Light the Mound). This verifies the spawn and that a stray is a
// valid sacrifice target.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const STRAYS = 'c-strays';

test('Strays drops two fodder bodies you can sacrifice', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 2 });
  for (let i = 0; i < 3; i++) await addCard(page, STRAYS);
  await fightEnemy(page, 'Silk Wraith');

  // Play Strays from the opening hand (cost 1, board starts empty).
  let played = false;
  for (let t = 0; t < 4 && !played; t++) {
    const c = handCardById(page, STRAYS).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); played = true; break; }
    await endTurn(page);
    const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click();
  }
  expect(played).toBeTruthy();

  // Two Strays now stand on the pitch.
  const strays = page.locator('[data-testid="board-animal"][data-animal-id="stray"]');
  await expect(strays).toHaveCount(2);

  // Sacrifice one — it leaves immediately (fodder → Block), leaving one.
  await page.getByTestId('sacrifice-animal').first().click();
  await expect(strays).toHaveCount(1);
});
