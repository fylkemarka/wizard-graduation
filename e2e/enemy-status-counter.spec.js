import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, playCardById, endTurn } from './helpers/lab.js';

// v3.4.84: Weak / Vulnerable no longer DRIFT by a fractional amount each
// turn — they run on a discrete turn counter shown in the "In effect" badge
// (e.g. "ENEMY WEAK 3t"). It refreshes to 3 on re-apply and ticks down 1/turn.
// This drives the App.jsx end-of-turn snap-home block + the CombatScreen
// badge render, proving the new counter shows up and decrements.

const SAP = 'c-sap';

async function ensureInHand(page, cardId, maxTurns = 6) {
  for (let i = 0; i < maxTurns; i++) {
    if (await handCardById(page, cardId).count() > 0) return true;
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
  }
  return (await handCardById(page, cardId).count()) > 0;
}

test('Sap arms an ENEMY WEAK badge with a turn counter that ticks down', async ({ page }) => {
  // 2026-06-07: Sap is wit-only now (lanes don't share cards) — wit lab.
  await gotoLab(page, 'wit', { seed: 7 });
  await page.getByRole('button', { name: /All Cards/ }).click();
  for (let i = 0; i < 6; i++) await addCard(page, SAP);
  await fightEnemy(page, 'Loom Familiar');

  expect(await ensureInHand(page, SAP)).toBeTruthy();
  await playCardById(page, SAP);

  // The enemy-weak badge arms with a 3-turn counter.
  const badge = page.getByText(/ENEMY WEAK/).first();
  await expect(badge).toBeVisible();
  await expect(page.getByText('3t').first()).toBeVisible();

  // End a turn — the counter ticks to 2 (no fractional drift).
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();
  await expect(page.getByText(/ENEMY WEAK/).first()).toBeVisible();
  await expect(page.getByText('2t').first()).toBeVisible();
});
