// Monoculture archetype (Alan, 2026-06-08): Best in Show (+2 to a repeat
// summon) and Pedigree (lock lures to your densest species).
//
// Best in Show is checked deterministically by staging TWO greens in the same
// turn: they transform in one end-of-turn tick in slot order, so the second
// buck sees the first already on the board and arrives at 5+2 = 7.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const GREENS = 'cv2-l-tender-greens';
const PEDIGREE = 'c-pedigree';
const BEST = 'c-best-in-show';

async function ensurePlay(page, cardId, maxTurns = 8) {
  for (let t = 0; t < maxTurns; t++) {
    const c = handCardById(page, cardId).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); return true; }
    await endTurn(page);
    const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click();
  }
  return false;
}
async function playIfPlayable(page, cardId) {
  const c = handCardById(page, cardId).first();
  if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); return true; }
  return false;
}

test('Best in Show gives a same-tick repeat buck +2; Pedigree plays', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1, forceSpecies: 'young-buck' });
  for (let i = 0; i < 10; i++) await addCard(page, GREENS);
  await addCard(page, BEST);
  await addCard(page, PEDIGREE);
  await fightEnemy(page, 'Silk Wraith');

  // Install Best in Show (ending turns as needed to draw it — no bucks yet),
  // then end the turn so the next one starts with full energy for two lures.
  expect(await ensurePlay(page, BEST)).toBeTruthy();
  await endTurn(page);
  { const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click(); }

  // Stage TWO greens this turn so both transform in one tick.
  expect(await playIfPlayable(page, GREENS)).toBeTruthy();
  expect(await playIfPlayable(page, GREENS)).toBeTruthy();
  await endTurn(page);
  const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click();

  const bucks = page.locator('[data-testid="board-animal"][data-animal-id="young-buck"]');
  await expect(bucks).toHaveCount(2);
  // Best in Show now buffs the WHOLE matched set: when the 2nd buck arrives,
  // BOTH bucks gain +2 → both read 7 dmg (5 base + 2).
  await expect(bucks.nth(0)).toContainText(/7 dmg/);
  await expect(bucks.nth(1)).toContainText(/7 dmg/);

  // Pedigree plays cleanly with bucks on the board (locks the bloodline).
  expect(await ensurePlay(page, PEDIGREE)).toBeTruthy();
  await expect(page.getByTestId('hand')).toBeVisible();
});
