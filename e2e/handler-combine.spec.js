import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

// Regression test for the COMBINE DETONATION (cycle 2, 2026-06-02): when all
// three tray slots hold the same species, they merge into a combine animal
// (Mouse House / Long Hare / McCloven) which now fires a one-time on-form
// burst the turn it forms. That burst is a fresh render path the sim exercises
// but a clean `vite build` won't catch.
//
// Tender Greens summons a RANDOM species (field-mouse/rabbit/young-buck), so a
// three-of-a-kind is normally an RNG triple. ?forceSpecies=field-mouse pins
// every pool pick to field-mouse (src/devSeed.js), making the Mouse House
// combine — and its 14-composure on-form burst — deterministic.

const GREENS = 'cv2-l-tender-greens';

test('three Field Mice combine into a Mouse House and the on-form burst renders', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 11, forceSpecies: 'field-mouse' });
  for (let i = 0; i < 8; i++) await addCard(page, GREENS);
  await fightEnemy(page, 'Loom Familiar');

  const dismissSteal = async () => {
    const ack = page.getByRole('button', { name: 'Acknowledged' });
    if ((await ack.count()) > 0) await ack.click();
  };
  const mouseHouseOnBoard = async () => (await page.getByText('🏠 Mouse House').count()) > 0;

  // Stage three Tender Greens per turn (intro/subject/target). They become
  // three Field Mice next turn; the end-of-turn combine pre-pass then merges
  // them into a Mouse House and fires the burst. Replay greens each turn until
  // the combine lands.
  let combined = false;
  for (let turn = 0; turn < 8 && !combined; turn++) {
    await dismissSteal();
    for (let p = 0; p < 3; p++) {
      const greens = handCardById(page, GREENS).first();
      if ((await greens.count()) > 0 && (await greens.getAttribute('data-playable')) === 'true') {
        await greens.click();
      }
    }
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
    combined = await mouseHouseOnBoard();
  }

  expect(combined).toBeTruthy();
  // The combine + its burst resolved on the end-turn above without crashing;
  // end one more turn to confirm the Mouse House keeps ticking cleanly.
  await dismissSteal();
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();
});
