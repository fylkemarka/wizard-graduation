// New Act-1 enemy mechanics (Alan, 2026-06-08): summon (mid-combat companion),
// charge (telegraphed big hit next turn), heal (self-regen). Forced via the
// ?forceIntentKind hook so the behaviour fires deterministically.

import { test, expect } from '@playwright/test';
import { gotoLab, fightEnemy, endTurn } from './helpers/lab.js';

test('Spinster Matron summons a companion mid-combat', async ({ page }) => {
  // Force the Matron's opening intent to `summon` (consumed once at enterFight).
  await gotoLab(page, 'handler', { seed: 3, forceIntentKind: 'summon' });
  await fightEnemy(page, 'The Spinster Matron');
  // No companion at the start (she begins solo).
  await expect(page.getByTestId('companion-panel')).toHaveCount(0);
  // End the turn → the summon intent resolves → a Thread Wisp joins.
  await endTurn(page);
  const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click();
  await expect(page.getByTestId('companion-panel')).toBeVisible();
  await expect(page.getByText(/Thread Wisp/).first()).toBeVisible();
});

test('Spindlewight winds up, then the charged strike lands', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 3, forceIntentKind: 'charge' });
  await fightEnemy(page, 'Spindlewight');
  // The opening intent is the wind-up — shown as a pending strike, no damage.
  await expect(page.getByText(/winds up/i).first()).toBeVisible();
  await endTurn(page);
  const ack = page.getByRole('button', { name: 'Acknowledged' }); if ((await ack.count()) > 0) await ack.click();
  // After the wind-up turn, the next telegraphed intent is the charged strike.
  await expect(page.getByText(/CHARGED/).first()).toBeVisible();
});
