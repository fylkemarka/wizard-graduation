import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

// Regression test for the maul intent (Alan, 2026-06-02): a mauling attack
// carries a normal attack value, but any HP that leaks past Block also tears
// the strongest animal off the board. Fully blocked → the menagerie is safe.
// This is exactly the render path a clean `vite build` won't exercise — the
// removal happens inside applyEnemyIntent via a post-tick board snapshot ref.
//
// Maul is a weighted enemy behavior, so ?forceMaul (src/devSeed.js) makes the
// NEXT intent roll pick the enemy's maul behavior (consumed once). We arm it
// before turn 1's end so it lands as the turn-2 intent — by which point the
// Birdseed animal has arrived and is on the board to be mauled.

const BIRDSEED = 'cv2-l-birdseed';

test('an unblocked maul tears the strongest animal off the board without crashing', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 7 });
  for (let i = 0; i < 10; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'Silk Wraith');

  // Arm the forced maul. enterFight already rolled turn-1's intent before this,
  // so the flag is consumed by the next-intent roll at the end of turn 1,
  // making MAUL the displayed (and turn-2-resolving) intent.
  await page.evaluate(() => { window.__forceMaul = true; });

  // Turn 1: stage an animal (Birdseed summons in 1 turn). Play NO block, so
  // when the maul resolves next turn the full hit leaks to HP.
  const seed = handCardById(page, BIRDSEED).first();
  if ((await seed.count()) > 0 && (await seed.getAttribute('data-playable')) === 'true') {
    await seed.click();
  }
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();

  // The bird has arrived on the board (pill shows its per-turn attack readout).
  const animalPill = page.getByText(/\/ turn|\(flops\)/);
  await expect(animalPill.first()).toBeVisible();
  const animalsBefore = await animalPill.count();
  expect(animalsBefore).toBeGreaterThan(0);
  // And the maul telegraph (🦷) is now the displayed intent.
  await expect(page.getByText(/🦷/).first()).toBeVisible();

  // Turn 2: animal is on the board, player has 0 block. Resolve the maul.
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible(); // no render crash

  // The maul leaked past Block and tore the animal off the board. A fresh
  // duration-3 animal on its first attack turn has no other reason to leave,
  // so the board going empty is the maul firing.
  await expect(page.getByText(/\/ turn|\(flops\)/)).toHaveCount(0);
});
