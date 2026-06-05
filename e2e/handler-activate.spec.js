import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

// Player-activated animal abilities (Alan, 2026-06-05): Mime / Pigeon / Kangaroo
// bring a VERB the player spends by CLICKING the on-board animal. This is a
// render path a clean `vite build` won't exercise — the click handler is built
// in CombatScreen and the dispatcher (activateAnimalFromSlot) mutates the tray
// and arms enemySkipNextTurn. The Mime is the cleanest assertion: it
// self-consumes, so clicking it should remove it from the board.

const WHITE_GLOVE = 'cv2-l-white-glove'; // summons the Mime in 1 turn
const EUCALYPTUS  = 'cv2-l-eucalyptus';  // summons the 2-slot Kangaroo in 1 turn

test('clicking a staged Mime fires its wall (self-consume) without crashing', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 7 });
  for (let i = 0; i < 10; i++) await addCard(page, WHITE_GLOVE);
  await fightEnemy(page, 'Silk Wraith');

  // Turn 1: stage the Mime lure (arrives next turn).
  const glove = handCardById(page, WHITE_GLOVE).first();
  expect(await glove.getAttribute('data-playable')).toBe('true');
  await glove.click();
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();

  // The Mime is now on the board.
  const mime = page.getByText(/🤫 Mime/).first();
  await expect(mime).toBeVisible();

  // Click it — the wall goes up and the Mime takes its bow (self-consume).
  await mime.click();
  await expect(page.getByTestId('hand')).toBeVisible(); // no render crash
  // Self-consume: the Mime is gone from the board.
  await expect(page.getByText(/🤫 Mime/)).toHaveCount(0);

  // Ending the turn skips the enemy (the wall) — combat survives the skip.
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();
});

test('a 2-slot Kangaroo lure stages across two slots and arrives without crashing', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 7 });
  for (let i = 0; i < 10; i++) await addCard(page, EUCALYPTUS);
  await fightEnemy(page, 'Silk Wraith');

  // Turn 1: stage the Kangaroo lure — it needs two adjacent empty slots.
  const euc = handCardById(page, EUCALYPTUS).first();
  expect(await euc.getAttribute('data-playable')).toBe('true');
  await euc.click();
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();

  // The Kangaroo arrived across its two-slot footprint.
  await expect(page.getByText(/🦘 Kangaroo/).first()).toBeVisible();

  // Click it to duck into the pouch — this ends the turn; combat survives the
  // pouch-guarded (no-damage) enemy turn.
  await page.getByText(/🦘 Kangaroo/).first().click();
  await expect(page.getByTestId('hand')).toBeVisible();
});
