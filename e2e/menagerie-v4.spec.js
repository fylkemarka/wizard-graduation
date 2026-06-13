// Menagerie v4: handler plays animal cards, CASTs the volley, feeds to persist,
// and ends turns without crashing.
import { test, expect } from '@playwright/test';
import { gotoLab, fightEnemy, handCards, handCardById, playCardById, endTurn } from './helpers/lab.js';

test('handler v4: stage animals, CAST fires them, end turn cycles', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 3 });
  await fightEnemy(page, 'Button Drone');
  await expect(page.getByTestId('hand')).toBeVisible();

  // Play any animal card in hand (starter is all animals).
  const before = await handCards(page).count();
  await handCards(page).first().click();
  await expect.poll(async () => handCards(page).count()).toBeLessThan(before);

  // CAST should be available and fire without crashing.
  const cast = page.getByRole('button', { name: /CAST/ });
  await expect(cast).toBeVisible();
  await cast.click();
  await expect(page.getByTestId('hand')).toBeVisible();

  // Play another, end the turn (implicit cast + enemy turn), survive a cycle.
  if (await handCards(page).count() > 0) await handCards(page).first().click();
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();
});
