// Summon Strength (Alan, 2026-06-08): STS-Strength for the Handler — Crack the
// Whip grants +2 Summon Strength, so every animal (on board AND future) attacks
// for +2 for the rest of combat. The 💪 chip surfaces it.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const GREENS = 'cv2-l-tender-greens';
const WHIP = 'c-rally-the-pack';

async function ensurePlay(page, cardId, maxTurns = 8) {
  for (let t = 0; t < maxTurns; t++) {
    const c = handCardById(page, cardId).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); return true; }
    await endTurn(page);
    const a = page.getByRole('button', { name: 'Acknowledged' }); if ((await a.count()) > 0) await a.click();
  }
  return false;
}

test('Rally the Pack gives every animal +2 attack (Summon Strength)', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 9, forceSpecies: 'young-buck' });
  for (let i = 0; i < 8; i++) await addCard(page, GREENS);
  await addCard(page, WHIP);
  await fightEnemy(page, 'Silk Wraith');

  // Install Rally the Pack FIRST (+2 Summon Strength, combat-wide). Drawing it
  // can burn turns, so we do it before any duration-2 buck exists — robust to
  // starter/deck-composition shifts.
  expect(await ensurePlay(page, WHIP)).toBeTruthy();
  await expect(page.getByTestId('summon-strength')).toBeVisible();

  // Summon a Young Buck — base 5 + 2 Summon Strength = 7, and never 5.
  expect(await ensurePlay(page, GREENS)).toBeTruthy();
  await endTurn(page);
  const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click();
  const buck = page.locator('[data-testid="board-animal"][data-animal-id="young-buck"]').first();
  await expect(buck).toBeVisible();
  await expect(buck).toContainText(/7 dmg/);
  await expect(buck).not.toContainText(/5 dmg/);
});
