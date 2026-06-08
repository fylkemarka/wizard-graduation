// Keeper + Basic Training (Alan, 2026-06-08): the menagerie-as-a-team retool.
// A Drystone Ox is a defensive KEEPER — long stay, braces for Block each turn.
// Basic Training invests in it: permanent +attack and +Block/turn for as long
// as it stays (slot.attackBonus / slot.blockBonus). The board pill surfaces the
// per-turn Block, the "💪 trained" badge, and the exit-bonus legibility tag.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const OATS = 'cv2-l-bag-of-oats';
const TRAIN = 'c-basic-training';

async function ensurePlay(page, cardId, maxTurns = 8) {
  for (let t = 0; t < maxTurns; t++) {
    const c = handCardById(page, cardId).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); return true; }
    await endTurn(page);
    const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click();
  }
  return false;
}

test('a Drystone Ox keeper braces for Block; Basic Training grows the wall and the swing', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1 });
  await addCard(page, OATS);
  for (let i = 0; i < 3; i++) await addCard(page, TRAIN);
  await fightEnemy(page, 'Silk Wraith');

  // Stage the oats lure, end the turn so the Ox arrives.
  expect(await ensurePlay(page, OATS)).toBeTruthy();
  await endTurn(page);
  { const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click(); }

  const ox = page.locator('[data-testid="board-animal"][data-animal-id="ox"]').first();
  await expect(ox).toBeVisible();
  // Keeper baseline: 2 dmg/turn and a 6 Block/turn wall.
  await expect(ox).toContainText(/2 dmg \/ turn/);
  await expect(ox).toContainText(/🛡 6\/turn/);

  // Play Basic Training → strengthen prompt arms → click the Ox.
  expect(await ensurePlay(page, TRAIN)).toBeTruthy();
  await expect(page.getByText(/Basic Training:/)).toBeVisible();
  await ox.click();

  // The wall and the swing both grow, and the trained badge appears.
  await expect(ox).toContainText(/5 dmg \/ turn/);   // 2 + 3
  await expect(ox).toContainText(/🛡 9\/turn/);       // 6 + 3
  await expect(ox).toContainText(/💪 trained/);
});
