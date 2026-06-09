import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

// Player-activated animal abilities: Pigeon / Kangaroo bring a VERB the player
// spends by CLICKING the on-board animal. This is a render path a clean
// `vite build` won't exercise — the click handler is built in CombatScreen
// and the dispatcher (activateAnimalFromSlot) mutates the tray.

const EUCALYPTUS  = 'cv2-l-eucalyptus';  // summons the 2-slot Kangaroo in 1 turn

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
