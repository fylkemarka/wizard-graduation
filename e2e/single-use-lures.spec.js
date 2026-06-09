// Handler v3, slice 1a — single-use lures (Alan, 2026-06-08). A lure leaves the
// deck when it summons its animal and returns to HAND only when that animal
// departs. This is the structural backbone of the team rework. The critical
// invariant: a departed animal's lure must come back (a lure that doesn't merge
// back is a "can't summon next combat" unwinnable-state bug).

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const OATS = 'cv2-l-bag-of-oats'; // summons the Drystone Ox (a keeper, attack 2)

async function ensurePlay(page, cardId, maxTurns = 6) {
  for (let t = 0; t < maxTurns; t++) {
    const c = handCardById(page, cardId).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); return true; }
    await endTurn(page);
    const a = page.getByRole('button', { name: 'Acknowledged' }); if ((await a.count()) > 0) await a.click();
  }
  return false;
}

test('a summoned lure leaves the deck and returns to hand when the animal departs', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1 });
  await addCard(page, OATS);
  await fightEnemy(page, 'Silk Wraith');

  // Summon the Ox: play the oats lure, end the turn so it transforms.
  expect(await ensurePlay(page, OATS)).toBeTruthy();
  await endTurn(page);
  { const a = page.getByRole('button', { name: 'Acknowledged' }); if ((await a.count()) > 0) await a.click(); }

  const ox = page.locator('[data-testid="board-animal"][data-animal-id="ox"]').first();
  await expect(ox).toBeVisible();

  // The lure that summoned it is now OUT of circulation — riding on the animal,
  // not in any pile. Count the copies currently in hand as the baseline.
  const lureInHand = () => handCardById(page, OATS).count();
  const before = await lureInHand();

  // Sacrifice the Ox (always-available pill) → it departs → its lure returns to
  // hand. before + 1.
  await ox.getByTestId('sacrifice-animal').click();
  await expect.poll(lureInHand).toBe(before + 1);
});
