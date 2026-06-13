import { test, expect } from '@playwright/test';
import { gotoLab, fightEnemy } from './helpers/lab.js';
test('handler v4: deck/discard pile views render the animal cards', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 7 });
  await fightEnemy(page, 'Button Drone');
  await page.getByTestId('draw-pile-btn').click();
  await expect(page.getByText('🗂 Draw pile', { exact: false })).toBeVisible();
  // The starter is all animals — at least one animal name must show in the modal.
  await expect(page.getByText(/Scrubjay|Young Buck|Porcupine|Tortoise|Stampede/).first()).toBeVisible();
});
