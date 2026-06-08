// Well-Drilled (Alan bug, 2026-06-08): drilling a species must buff EVERY
// copy — those already on the board AND any summoned later this combat. The
// old version stamped only the on-board copies, so a Young Buck summoned
// after Well-Drilled still swung for its base 5 instead of 7.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const GREENS = 'cv2-l-tender-greens'; // summons field-mouse/rabbit/young-buck
const WELL_DRILLED = 'c-well-drilled';

async function playWhenPlayable(page, cardId, maxTurns = 6) {
  for (let t = 0; t < maxTurns; t++) {
    const c = handCardById(page, cardId).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); return true; }
    await endTurn(page);
    const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click();
  }
  return false;
}

test('a buck summoned AFTER Well-Drilled still gets the +2', async ({ page }) => {
  // Pin every Tender Greens roll to Young Buck (base 5 attack).
  await gotoLab(page, 'handler', { seed: 9, forceSpecies: 'young-buck' });
  for (let i = 0; i < 8; i++) await addCard(page, GREENS);
  await addCard(page, WELL_DRILLED);
  await fightEnemy(page, 'Silk Wraith');

  // Stage a lure and let the first Young Buck arrive.
  expect(await playWhenPlayable(page, GREENS)).toBeTruthy();
  await endTurn(page);
  let ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click();
  const buck = page.locator('[data-testid="board-animal"][data-animal-id="young-buck"]').first();
  await expect(buck).toBeVisible();
  await expect(buck).toContainText(/5 dmg/); // base before drilling

  // Install Well-Drilled, then click the buck to drill the species.
  expect(await playWhenPlayable(page, WELL_DRILLED)).toBeTruthy();
  await buck.click();
  await expect(buck).toContainText(/7 dmg/); // on-board copy now +2

  // Summon a SECOND buck on a later turn — it must arrive drilled (7), not 5.
  expect(await playWhenPlayable(page, GREENS)).toBeTruthy();
  await endTurn(page);
  ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click();

  const bucks = page.locator('[data-testid="board-animal"][data-animal-id="young-buck"]');
  await expect(bucks.count()).resolves.toBeGreaterThanOrEqual(1);
  // Every buck on the board reads 7 dmg — none stuck at the base 5.
  const n = await bucks.count();
  for (let i = 0; i < n; i++) {
    await expect(bucks.nth(i)).toContainText(/7 dmg/);
    await expect(bucks.nth(i)).not.toContainText(/5 dmg/);
  }
});
