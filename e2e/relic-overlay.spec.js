// The Relic Acquired overlay — every relic grant should be an EVENT the
// player can't miss, not a log line. The starting-supplies grant at
// character pick is the deterministic way to trigger one.

import { test, expect } from '@playwright/test';

test('picking a character announces the starter relic, click dismisses', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Begin/ }).click();
  await expect(page.getByRole('heading', { name: 'Choose Your Wizard' })).toBeVisible();

  // Handler has the simplest post-pick flow (no FFT row screen).
  const card = page.locator('div').filter({ has: page.getByRole('heading', { name: 'The Handler', exact: true }) }).last();
  await card.getByRole('button', { name: 'Choose' }).click();

  // Overlay announces the pickup with its source and rarity badge.
  const overlay = page.getByText(/Relic Acquired — Starting supplies/);
  await expect(overlay).toBeVisible();
  await expect(page.getByText('click to continue')).toBeVisible();

  // Click anywhere on the overlay dismisses it.
  await page.getByText('click to continue').click();
  await expect(overlay).not.toBeVisible();
});
