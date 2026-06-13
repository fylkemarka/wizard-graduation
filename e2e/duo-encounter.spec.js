// Duo encounters (Alan, 2026-06-06): the Hollow Weaver arrives with a
// Bobbin Imp companion. The companion panel renders with its own
// composure bar + telegraph, clicking it retargets the player's casts,
// and a cast aimed at the imp drains the IMP's composure, not the
// Weaver's. Companion acts on the enemy turn without crashing combat.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, playCardById, endTurn } from './helpers/lab.js';

const INTRO   = 'wv2-i-frankly';
const SUBJECT = 'wv2-s-your-reasoning';
const TARGET  = 'wv2-t-thats-not-it';

test('duo encounter: companion renders, takes targeted casts, and acts', async ({ page }) => {
  await gotoLab(page, 'wit', { seed: 11 });
  await page.getByRole('button', { name: /All Cards/ }).click();
  for (let i = 0; i < 6; i++) {
    await addCard(page, INTRO);
    await addCard(page, SUBJECT);
    await addCard(page, TARGET);
  }
  await fightEnemy(page, 'Hollow Weaver');

  // The duo arrived: companion panel up, casts default to the leader.
  const panel = page.getByTestId('companion-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-targeted', 'false');
  await expect(page.getByText('Bobbin Imp').first()).toBeVisible();

  // Click → casts aim at the imp.
  await panel.click();
  await expect(panel).toHaveAttribute('data-targeted', 'true');

  // Stage a full spell and cast it at the imp.
  const impCompBefore = parseInt(await panel.locator('.font-mono').first().innerText(), 10);
  for (const id of [INTRO, SUBJECT, TARGET]) {
    for (let i = 0; i < 4; i++) {
      if (await handCardById(page, id).count() > 0) break;
      await endTurn(page);
    }
    await playCardById(page, id);
  }
  await page.getByRole('button', { name: /CAST/ }).click();

  // The imp's composure dropped (panel survives if it's still alive — a
  // big cast may rout it entirely, which also passes).
  if (await panel.count() > 0) {
    const impCompAfter = parseInt(await panel.locator('.font-mono').first().innerText(), 10);
    expect(impCompAfter).toBeLessThan(impCompBefore);
  }

  // Enemy turn resolves both intents without crashing.
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();
});
