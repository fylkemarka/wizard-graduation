import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

// Regression test for the Salmon predator gamble (Alan, 2026-06-02): each turn
// a Salmon is on the board it has a 50% chance to attract a predator and
// transform in place — usually a bird (Hawk/Owl), sometimes a Bear. The roll
// runs in an end-of-turn pre-pass and the Owl branch applies a pre-attack
// Vulnerable next turn — exactly the kind of render path a clean `vite build`
// won't exercise.
//
// The roll is a 50%-per-turn random event, so hunting a magic seed is fragile.
// Instead ?forceSalmonRoll=owl (src/devSeed.js) forces the next roll to succeed
// as an Owl, consumed once — so this test is stable.

const FISH = 'cv2-l-fish-food';

test('a forced Salmon→Owl roll renders and combat survives the owl turn', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 7, forceSalmonRoll: 'owl' });
  for (let i = 0; i < 8; i++) await addCard(page, FISH);
  await fightEnemy(page, 'Loom Familiar');

  // Loom Familiar occasionally steals a card and pops a modal that pauses
  // combat — dismiss it whenever it appears so it never blocks our clicks.
  const dismissSteal = async () => {
    const ack = page.getByRole('button', { name: 'Acknowledged' });
    if ((await ack.count()) > 0) await ack.click();
  };
  // Detect the roll by the Owl pill that lands on the board (the transient
  // "draws a" log line scrolls out of the 20-line buffer too quickly).
  const owlOnBoard = async () => (await page.getByText('🦉 Owl').count()) > 0;

  // Stage Salmon (Fish Food → salmon next turn) and run turns until the forced
  // Owl roll fires. Replay Fish Food whenever it's playable so a salmon is
  // reliably on the board for the predator-roll pre-pass to catch.
  let rolled = false;
  for (let turn = 0; turn < 8 && !rolled; turn++) {
    await dismissSteal();
    const fish = handCardById(page, FISH).first();
    if ((await fish.count()) > 0 && (await fish.getAttribute('data-playable')) === 'true') {
      await fish.click();
    }
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
    rolled = await owlOnBoard();
  }

  expect(rolled).toBeTruthy();
  // The owl's first real attack + its pre-attack Vulnerable land the turn
  // after it rolls in — end one more turn and confirm no render crash.
  await dismissSteal();
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();
});
