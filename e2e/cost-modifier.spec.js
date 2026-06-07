import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, playCardById, endTurn } from './helpers/lab.js';

// Verifies the hand reflects live cost modifiers (the "Food in the Pocket"
// bug): when a next-card-free effect is armed, a card that would otherwise
// be too expensive must read cost 0 and stay playable, not gray out.
//
// Determinism: we stack many copies of both cards so the opening hand almost
// always holds them; ensureInHand cycles a couple of turns as a safety net.

const FOOD = 'c-freebie'; // "That Was a Freebie" — next card free (split from the shared card 2026-06-07)
const PRICEY = 'c-buffet';         // Buffet — cost 2

async function ensureInHand(page, cardId, maxTurns = 4) {
  for (let i = 0; i < maxTurns; i++) {
    if (await handCardById(page, cardId).count() > 0) return true;
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
  }
  return (await handCardById(page, cardId).count()) > 0;
}

test('next-card-free makes an over-cost card playable in hand', async ({ page }) => {
  // seed 1 keeps the opening hand deterministic and steal-free (the Loom
  // Familiar's card-steal modal otherwise intercepts clicks at random).
  await gotoLab(page, 'handler', { seed: 1 });
  for (let i = 0; i < 6; i++) { await addCard(page, FOOD); await addCard(page, PRICEY); }
  await fightEnemy(page, 'Loom Familiar');

  const dismissSteal = async () => {
    const ack = page.getByRole('button', { name: 'Acknowledged' });
    if ((await ack.count()) > 0) await ack.click();
  };

  // Both cards present in the opening hand (cycle a turn or two if not).
  expect(await ensureInHand(page, FOOD)).toBeTruthy();
  expect(await ensureInHand(page, PRICEY)).toBeTruthy();
  await dismissSteal();

  // Arm "next card free".
  await playCardById(page, FOOD);

  // The pricey card must now read effective cost 0 and be playable, even if
  // energy is below its base cost.
  const buffet = handCardById(page, PRICEY).first();
  await expect(buffet).toHaveAttribute('data-eff-cost', '0');
  await expect(buffet).toHaveAttribute('data-playable', 'true');
});
