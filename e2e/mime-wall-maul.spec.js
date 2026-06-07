// Mime wall vs maul (Alan's report, 2026-06-07: "Mime summon didn't stop
// a maul"). Canonical sequence: maul telegraphed → wall activated → end
// turn. The enemy's whole turn is forfeit: zero HP leak, no animal torn.
// Also asserts the WALL UP banner — the activation previously had no
// visible feedback beyond a log line, so a click that silently did
// something else (e.g. an armed Treat prompt eating the Mime) was
// indistinguishable from a wall that failed.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

test('an activated mime wall stops a telegraphed maul outright', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1, forceSpecies: 'goose' });
  for (let i = 0; i < 6; i++) await addCard(page, 'cv2-l-white-glove');
  for (let i = 0; i < 6; i++) await addCard(page, 'cv2-l-birdseed');
  await fightEnemy(page, 'Silk Wraith');
  await page.evaluate(() => { window.__forceMaul = true; });

  const play = async (id) => {
    const c = handCardById(page, id).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') await c.click();
  };
  // T1: stage the Mime lure + a bird (both arrive at end of turn).
  await play('cv2-l-white-glove');
  await play('cv2-l-birdseed');
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();

  // Maul telegraphed; mime + goose on board.
  await expect(page.getByText(/🦷/).first()).toBeVisible();
  const mime = page.getByText(/🤫 Mime/).first();
  await expect(mime).toBeVisible();
  const readHp = async () =>
    parseInt(await page.locator('[title^="HP — physical health"]').first().innerText(), 10);
  const hpBefore = await readHp();

  // Wall up — the banner confirms the click actually armed it.
  await mime.click();
  await expect(page.getByTestId('enemy-turn-skipped')).toBeVisible();

  // End turn with NO block: the skip must eat the maul whole.
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();
  expect(await readHp()).toBe(hpBefore);
  await expect(page.getByText(/🪿 Goose/).first()).toBeVisible();
  // Wall consumed — banner gone for the fresh telegraph.
  await expect(page.getByTestId('enemy-turn-skipped')).toHaveCount(0);
});
