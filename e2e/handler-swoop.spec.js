import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

// Regression test for the raptor swoop (Alan, 2026-06-02): each turn a Field
// Mouse or Salmon on the board can be swooped by a Hawk (65%) or Owl (35%),
// which takes its slot. The swoop runs in an end-of-turn pre-pass and the Owl
// branch applies a pre-attack Vulnerable next turn — exactly the kind of
// render path a clean `vite build` won't exercise.
//
// The swoop is a sub-2%-per-prey random event, so hunting a magic seed is
// fragile. Instead ?forceSwoop=owl (src/devSeed.js) fires the next eligible
// swoop deterministically as an Owl, consumed once — so this test is stable.

const FISH = 'cv2-l-fish-food';

test('a forced Owl swoop renders and combat survives the swoop + owl turn', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 7, forceSwoop: 'owl' });
  for (let i = 0; i < 8; i++) await addCard(page, FISH);
  await fightEnemy(page, 'Loom Familiar');

  // Loom Familiar occasionally steals a card and pops a modal that pauses
  // combat — dismiss it whenever it appears so it never blocks our clicks.
  const dismissSteal = async () => {
    const ack = page.getByRole('button', { name: 'Acknowledged' });
    if ((await ack.count()) > 0) await ack.click();
  };
  // Detect the swoop by the Owl pill that lands on the board (the transient
  // "swoops in" log line scrolls out of the 20-line buffer too quickly).
  const owlOnBoard = async () => (await page.getByText('🦉 Owl').count()) > 0;

  // Stage Salmon (Fish Food → salmon in 2 turns) and run turns until the
  // forced Owl swoop fires. Replay Fish Food whenever it's playable so a
  // salmon is reliably on the board for the swoop pre-pass to catch.
  let swooped = false;
  for (let turn = 0; turn < 8 && !swooped; turn++) {
    await dismissSteal();
    const fish = handCardById(page, FISH).first();
    if ((await fish.count()) > 0 && (await fish.getAttribute('data-playable')) === 'true') {
      await fish.click();
    }
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
    swooped = await owlOnBoard();
  }

  expect(swooped).toBeTruthy();
  // The owl's first real attack + its pre-attack Vulnerable land the turn
  // after it swoops in — end one more turn and confirm no render crash.
  await dismissSteal();
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();
});
