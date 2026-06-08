// Sloth slow visibility (Alan, 2026-06-08: "I couldn't tell the effect was
// going into effect"). When a sloth is on the board and the upcoming enemy
// turn will be slowed, the intent panel shows a "🦥 SLOTH'D" banner and dims
// the telegraphed intent — so the slow is legible BEFORE you end your turn.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const SLOTH_LURE = 'cv2-l-low-branch'; // A Low, Slow Branch → Sloth in 4 turns

test('a sloth on board surfaces the SLOTH’D intent banner', async ({ page }) => {
  // Silk Wraith: composure-immune-to-modals foe (no card-steal). The player
  // deals no damage with just the lure (sloth has 0 attack), so the fight
  // rides on far past the 4-turn sloth arrival.
  await gotoLab(page, 'handler', { seed: 1 });
  for (let i = 0; i < 4; i++) await addCard(page, SLOTH_LURE);
  await fightEnemy(page, 'Silk Wraith');

  // Play a sloth lure whenever one is in hand; block with starter Step Backs
  // (the handler starts with them) to survive the 4-turn arrival + wait.
  let sawBanner = false;
  for (let t = 0; t < 16 && !sawBanner; t++) {
    const lure = handCardById(page, SLOTH_LURE).first();
    if ((await lure.count()) > 0 && (await lure.getAttribute('data-playable')) === 'true') await lure.click();
    const step = handCardById(page, 'c-defend-handler').first();
    if ((await step.count()) > 0 && (await step.getAttribute('data-playable')) === 'true') await step.click();
    await endTurn(page);
    if ((await page.getByTestId('hand').count()) === 0) break; // combat ended
    sawBanner = (await page.getByTestId('enemy-slothd').count()) > 0;
  }
  expect(sawBanner).toBeTruthy();
});
