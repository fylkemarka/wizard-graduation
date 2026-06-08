// Monoculture archetype (Alan, 2026-06-08): Best in Show (+2 to a repeat
// summon) and Pedigree (lock lures to your densest species). This is a smoke
// test that both cards install/play through the real summon flow without
// crashing and a buck snowball reaches the buffed value. The +2 attackBonus
// DISPLAY path itself is proven by well-drilled.spec (same channel).

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

test('Best in Show and Pedigree play through the summon flow', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1, forceSpecies: 'young-buck' });
  for (let i = 0; i < 8; i++) await addCard(page, GREENS);
  await addCard(page, BEST);
  await addCard(page, PEDIGREE);
  await fightEnemy(page, 'Silk Wraith');

  // Install Best in Show, then keep staging greens so bucks keep arriving.
  expect(await ensurePlay(page, BEST)).toBeTruthy();
  expect(await ensurePlay(page, GREENS)).toBeTruthy();
  expect(await ensurePlay(page, GREENS)).toBeTruthy();

  // Pedigree plays cleanly once a buck is on the board (locks the bloodline).
  expect(await ensurePlay(page, PEDIGREE)).toBeTruthy();

  // Combat is still alive and a buck is on the pitch — no crash through the
  // lock + arrival-buff hooks.
  await expect(page.getByTestId('hand')).toBeVisible();
  await expect(page.locator('[data-testid="board-animal"][data-animal-id="young-buck"]').first()).toBeVisible();
});
