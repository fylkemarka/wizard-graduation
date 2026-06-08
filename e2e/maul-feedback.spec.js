// Maul feedback (Alan, 2026-06-08: "make it more obvious which animal has
// died and why"). When a maul tears an animal off the board, a centred toast
// names the animal, the enemy, and the reason — on top of the screen shake +
// red edge-flash that fire on any player hit.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

test('a maul shows a toast naming the torn animal and why', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 7, forceSpecies: 'goose' });
  for (let i = 0; i < 10; i++) await addCard(page, 'cv2-l-birdseed');
  await fightEnemy(page, 'Silk Wraith');
  await page.evaluate(() => { window.__forceMaul = true; });

  // Stage a goose; end turn (it arrives), maul telegraphs; end again to resolve.
  const c = handCardById(page, 'cv2-l-birdseed').first();
  if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') await c.click();
  await endTurn(page);
  await expect(page.getByText(/🦷/).first()).toBeVisible(); // maul telegraphed, no block played
  await endTurn(page);

  // Toast names the animal + reason.
  await expect(page.getByText(/torn off the board/).first()).toBeVisible();
  await expect(page.getByText(/mauled it/).first()).toBeVisible();
});
