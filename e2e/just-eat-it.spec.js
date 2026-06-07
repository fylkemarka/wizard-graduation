// Just Eat It on a multi-species lure (Alan's report, 2026-06-07: "it
// blanked out the staged card and then it disappeared the next turn").
// Tender Greens / Birdseed carry an animalIds POOL — slot.animalId is
// null — so the old handler stamped animalId:undefined → a blank
// envelope that vanished. This pins: eat a staged Tender Greens, a REAL
// animal arrives immediately and survives the next tick.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const GREENS = 'cv2-l-tender-greens';
const EAT = 'c-just-eat-it';

test('Just Eat It summons a real animal from a pooled lure (no blank slot)', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1, forceSpecies: 'field-mouse' });
  for (let i = 0; i < 8; i++) await addCard(page, GREENS);
  for (let i = 0; i < 4; i++) await addCard(page, EAT);
  await fightEnemy(page, 'Loom Familiar');

  const playIfHeld = async (id) => {
    const c = handCardById(page, id).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') {
      await c.click();
      return true;
    }
    return false;
  };

  // Stage a Tender Greens lure (it would summon NEXT turn).
  const staged = await (async () => {
    for (let t = 0; t < 4; t++) {
      if (await playIfHeld(GREENS)) return true;
      await endTurn(page);
      await expect(page.getByTestId('hand')).toBeVisible();
    }
    return false;
  })();
  expect(staged).toBeTruthy();

  // Play Just Eat It and target the staged lure.
  expect(await playIfHeld(EAT)).toBeTruthy();
  // Eat It arms a pick prompt — click the staged lure pill.
  const lurePill = page.getByText(/in 1t|Tender Greens/i).first();
  if (await lurePill.count() > 0) await lurePill.click();

  // A real Field Mouse arrives immediately (its attack/flop readout shows),
  // and it is NOT a blank — the pill names it.
  await expect(page.getByText(/🐭 Field Mouse/).first()).toBeVisible();

  // Survives the next tick (a blank slot would vanish here).
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();
  await expect(page.getByText(/🐭 Field Mouse/).first()).toBeVisible();
});
