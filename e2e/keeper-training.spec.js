// Keeper + Basic Training (Alan, 2026-06-08): the menagerie-as-a-team retool.
// A Drystone Ox is a defensive KEEPER — long stay, braces for Block each turn.
// Basic Training invests in it: permanent +attack and +Block/turn for as long
// as it stays (slot.attackBonus / slot.blockBonus). The board pill surfaces the
// per-turn Block, the "💪 trained" badge, and the exit-bonus legibility tag.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const OATS = 'cv2-l-bag-of-oats';
const WHET = 'c-whet-claws';      // +attack, exhaust
const HIDE = 'c-thicken-hide';    // +block/turn, exhaust

async function ensurePlay(page, cardId, maxTurns = 8) {
  for (let t = 0; t < maxTurns; t++) {
    const c = handCardById(page, cardId).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); return true; }
    await endTurn(page);
    const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click();
  }
  return false;
}

test('a Drystone Ox keeper braces for Block; split training grows the wall and the swing', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1 });
  await addCard(page, OATS);
  for (let i = 0; i < 4; i++) await addCard(page, WHET);   // copies for the escalation check
  await addCard(page, HIDE);
  await fightEnemy(page, 'Silk Wraith');

  // Stage the oats lure, end the turn so the Ox arrives.
  expect(await ensurePlay(page, OATS)).toBeTruthy();
  await endTurn(page);
  { const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click(); }

  const ox = page.locator('[data-testid="board-animal"][data-animal-id="ox"]').first();
  await expect(ox).toBeVisible();
  // Keeper baseline: 2 dmg/turn and a 6 Block/turn wall.
  await expect(ox).toContainText(/2 dmg \/ turn/);
  await expect(ox).toContainText(/🛡 4\/turn/);

  // Whet the Claws → offense only: 2 → 3 dmg, block unchanged.
  expect(await ensurePlay(page, WHET)).toBeTruthy();
  await expect(page.getByText(/💪 Training:/)).toBeVisible();
  await ox.click();
  await expect(ox).toContainText(/3 dmg \/ turn/);   // 2 + 1
  await expect(ox).toContainText(/🛡 4\/turn/);       // block untouched
  await expect(ox).toContainText(/💪 trained/);

  // Thicken the Hide → defense only: block 6 → 9, attack unchanged.
  expect(await ensurePlay(page, HIDE)).toBeTruthy();
  await ox.click();
  await expect(ox).toContainText(/3 dmg \/ turn/);   // attack untouched
  await expect(ox).toContainText(/🛡 6\/turn/);       // 4 + 2

  // The pending menagerie Block now shows on the Player block stat (6 from
  // the Ox: 4 base + 2 Thicken, surfaced so it nets against the intent bar).
  await expect(page.getByTestId('pending-menagerie-block')).toContainText(/\+6/);

  // Escalating cost (anti-spam): a SECOND Whet the Claws this combat costs 1
  // more (base 1 → 2). Draw one and check its effective cost on the pill. (Run
  // last — it may end turns; the Ox is a keeper so it sticks around.)
  let nextWhet = handCardById(page, WHET).first();
  for (let t = 0; t < 4 && (await nextWhet.count()) === 0; t++) {
    await endTurn(page);
    const a = page.getByRole('button', { name: 'Acknowledged' }); if ((await a.count()) > 0) await a.click();
    nextWhet = handCardById(page, WHET).first();
  }
  await expect(nextWhet).toHaveAttribute('data-eff-cost', '2');
});
