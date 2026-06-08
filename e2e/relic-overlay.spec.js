// Starting a run grants NO random relic (Alan, 2026-06-07: "stop giving
// players a random card on starting"). Picking a character goes straight
// to the familiar shop with no Relic Acquired overlay. The overlay itself
// still fires for earned relics (elite/boss/shop) — that path is exercised
// in real play, not here.

import { test, expect } from '@playwright/test';

test('picking a character grants no starting relic', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Begin/ }).click();
  await expect(page.getByRole('heading', { name: 'Choose Your Wizard' })).toBeVisible();

  const card = page.locator('div').filter({ has: page.getByRole('heading', { name: 'The Handler', exact: true }) }).last();
  await card.getByRole('button', { name: 'Choose' }).click();

  // No Relic Acquired overlay — straight to the familiar shop.
  await expect(page.getByRole('heading', { name: 'The Familiar Shop' })).toBeVisible();
  await expect(page.getByText(/Relic Acquired/)).toHaveCount(0);
});
