// Handler v3 slice 2 (Alan, 2026-06-08): training-engine POWERS. A passive
// power that, at the START of each of your turns, trains ONE animal forever
// (+1 permanent attack or +1 permanent Block/turn — rides slot.attackBonus /
// slot.blockBonus, same model as Whet the Claws). It builds a powerhouse over
// time; the buff is lost if that animal leaves. This proves Sergeant-at-Arms
// bumps an animal's attack by 1 after a turn passes.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const OATS    = 'cv2-l-bag-of-oats';        // summons a Drystone Ox keeper (2 atk)
const SERGEANT = 'c-sergeant-at-arms';      // start-of-turn: +1 attack to hardest hitter

async function ensurePlay(page, cardId, maxTurns = 8) {
  for (let t = 0; t < maxTurns; t++) {
    const c = handCardById(page, cardId).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); return true; }
    await endTurn(page);
    const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click();
  }
  return false;
}

test('Sergeant-at-Arms trains the hardest hitter +1 attack each turn', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1 });
  await addCard(page, OATS);
  await addCard(page, SERGEANT);
  await fightEnemy(page, 'Silk Wraith');

  // Stage the oats lure, end the turn so the Ox arrives.
  expect(await ensurePlay(page, OATS)).toBeTruthy();
  await endTurn(page);
  { const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click(); }

  const ox = page.locator('[data-testid="board-animal"][data-animal-id="ox"]').first();
  await expect(ox).toBeVisible();
  // Keeper baseline before any training: 2 dmg/turn.
  await expect(ox).toContainText(/2 dmg \/ turn/);

  // Install the power (no target prompt — it auto-trains each turn).
  expect(await ensurePlay(page, SERGEANT)).toBeTruthy();

  // End the turn: the start-of-next-turn power tick trains the Ox +1 attack.
  await endTurn(page);
  { const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click(); }

  // The Ox now swings for 3 (2 base + 1 trained) and wears the trained badge.
  await expect(ox).toContainText(/3 dmg \/ turn/);
  await expect(ox).toContainText(/💪 trained/);

  // One more turn → +1 again: the powerhouse keeps building (4 dmg/turn).
  await endTurn(page);
  { const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click(); }
  await expect(ox).toContainText(/4 dmg \/ turn/);
});
