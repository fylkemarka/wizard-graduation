import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy } from './helpers/lab.js';

// The draw / discard pile counts are clickable (Alan, 2026-06-01): clicking
// either opens a modal listing that pile's cards. The draw-pile view is sorted
// (by cost), NOT in draw order, so it doesn't leak the next-draw sequence.
// A clean `vite build` won't catch a render crash in the new modal, so drive it.

const BIRDSEED = 'cv2-l-birdseed';

test('draw and discard pile counts open a card-list modal', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 7 });
  for (let i = 0; i < 10; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'Loom Familiar');

  // Draw pile: open, see the sorted-order note, close.
  await page.getByTestId('draw-pile-btn').click();
  await expect(page.getByText('🗂 Draw pile', { exact: false })).toBeVisible();
  await expect(page.getByText(/NOT in the order you'll draw/)).toBeVisible();
  await page.getByRole('button', { name: '✕' }).click();
  await expect(page.getByText('🗂 Draw pile', { exact: false })).toHaveCount(0);

  // Discard pile: opens without crashing (may be empty at turn 1).
  await page.getByTestId('discard-pile-btn').click();
  await expect(page.getByText('🗑 Discard pile', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '✕' }).click();

  // Combat still alive after closing both modals.
  await expect(page.getByTestId('hand')).toBeVisible();
});
