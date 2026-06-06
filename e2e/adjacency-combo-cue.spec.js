// Adjacency-combo cue (Alan, 2026-06-06): when two neighbouring animals
// will fire a joint combo (e.g. Field Mouse + Rabbit = Warren Rush), BOTH
// board pills get a dotted green outline + data-combo attribute so the
// player sees the pair is creating something.
//
// Determinism: forceSpecies now accepts a comma list consumed in order, so
// two Tender Greens resolve to field-mouse then rabbit — a guaranteed
// Warren Rush pair in adjacent slots.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const GREENS = 'cv2-l-tender-greens';

test('an adjacent combo pair shows the dotted outline cue on both animals', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 11, forceSpecies: 'field-mouse,rabbit' });
  for (let i = 0; i < 8; i++) await addCard(page, GREENS);
  await fightEnemy(page, 'Loom Familiar');

  const dismissSteal = async () => {
    const ack = page.getByRole('button', { name: 'Acknowledged' });
    if ((await ack.count()) > 0) await ack.click();
  };

  // Stage two greens per turn until the mouse+rabbit pair is on the board
  // with the combo cue. Lures land first-empty → intro + subject = adjacent.
  const comboPills = page.locator('[data-combo="Warren Rush"]');
  let cued = 0;
  for (let turn = 0; turn < 8 && cued < 2; turn++) {
    await dismissSteal();
    for (let p = 0; p < 2; p++) {
      const greens = handCardById(page, GREENS).first();
      if ((await greens.count()) > 0 && (await greens.getAttribute('data-playable')) === 'true') {
        await greens.click();
      }
    }
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
    cued = await comboPills.count();
  }

  // Both halves of the pair carry the cue.
  expect(cued).toBe(2);

  // The cue's tooltip names the combo so hover explains the outline.
  await expect(comboPills.first()).toHaveAttribute('title', /Warren Rush/);
});
