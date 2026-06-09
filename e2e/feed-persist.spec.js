// Handler v3 slice 1b — feeding-as-button + persist (Alan, 2026-06-08). Feeding
// is now a 1-energy SPECIES action (a button on the hungry animal), not a card
// drop. Feeding RESETS the timer, so a fed animal persists indefinitely — past
// the 2-3 turn life it would otherwise have. The recurring energy cost is the
// maintenance tension.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const GREENS = 'cv2-l-tender-greens';

async function ackIfPresent(page) {
  const a = page.getByRole('button', { name: 'Acknowledged' }); if ((await a.count()) > 0) await a.click();
}
async function ensurePlay(page, cardId, maxTurns = 6) {
  for (let t = 0; t < maxTurns; t++) {
    const c = handCardById(page, cardId).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); return true; }
    await endTurn(page); await ackIfPresent(page);
  }
  return false;
}

test('feeding a species (1 energy) resets its timer so the animal persists', async ({ page }) => {
  // Pin summons to Field Mouse (2 dmg, slow to kill the enemy; natural life ~3 turns).
  await gotoLab(page, 'handler', { seed: 3, forceSpecies: 'field-mouse' });
  await addCard(page, GREENS);
  await fightEnemy(page, 'Silk Wraith');

  // Summon a Field Mouse.
  expect(await ensurePlay(page, GREENS)).toBeTruthy();
  await endTurn(page); await ackIfPresent(page);
  const mouse = page.locator('[data-testid="board-animal"][data-animal-id="field-mouse"]').first();
  await expect(mouse).toBeVisible();

  // Keep it alive by feeding whenever the 🍴 feed button appears. Over 5 turns —
  // well past its unfed life — it must still be on the board, and each feed must
  // cost energy.
  const feedBtn = () => mouse.getByTestId('feed-species');
  const energyEl = page.getByTestId('player-energy');
  let everFed = false;
  for (let turn = 0; turn < 5; turn++) {
    if ((await feedBtn().count()) > 0) {
      const before = parseInt(await energyEl.getAttribute('data-energy'), 10);
      await feedBtn().click();
      await expect.poll(async () => parseInt(await energyEl.getAttribute('data-energy'), 10)).toBe(before - 1);
      everFed = true;
    }
    await endTurn(page); await ackIfPresent(page);
    // If the enemy died, stop — persistence was already demonstrated.
    if ((await page.getByRole('button', { name: 'Acknowledged' }).count()) > 0) break;
  }

  expect(everFed).toBeTruthy();              // the feed button actually appeared + worked
  await expect(mouse).toBeVisible();         // persisted past its natural unfed life
});
