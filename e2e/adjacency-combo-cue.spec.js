// Adjacency-combo cue (Alan, 2026-06-06): when two neighbouring animals
// will fire a joint combo (e.g. Field Mouse + Rabbit = Warren Rush), BOTH
// board pills get a dotted green outline + data-combo attribute so the
// player sees the pair is creating something.
//
// Determinism (updated slice 5, 2026-06-08): Tender Greens narrowed to
// mouse/buck — rabbit moved to the single-species "A Clover Patch" lure.
// So the Warren Rush pair is built from forceSpecies=field-mouse (Tender
// Greens) PLUS a Clover Patch (always a rabbit) — both adjacent.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const GREENS = 'cv2-l-tender-greens';
const CLOVER = 'cv2-l-clover-patch';

test('an adjacent combo pair shows the dotted outline cue on both animals', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 11, forceSpecies: 'field-mouse' });
  for (let i = 0; i < 8; i++) { await addCard(page, GREENS); await addCard(page, CLOVER); }
  await fightEnemy(page, 'Loom Familiar');

  const dismissSteal = async () => {
    const ack = page.getByRole('button', { name: 'Acknowledged' });
    if ((await ack.count()) > 0) await ack.click();
  };

  // Stage a mouse (Tender Greens) + a rabbit (Clover Patch) per turn until the
  // pair is on the board with the combo cue. Lures land first-empty → adjacent.
  const comboPills = page.locator('[data-combo="Warren Rush"]');
  let cued = 0;
  for (let turn = 0; turn < 8 && cued < 2; turn++) {
    await dismissSteal();
    for (const id of [GREENS, CLOVER]) {
      const c = handCardById(page, id).first();
      if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') {
        await c.click();
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

  // v3.5: the pair is wrapped in ONE dotted box with a "Combo" tag below.
  await expect(page.getByText(/✨ Combo/i).first()).toBeVisible();
});
