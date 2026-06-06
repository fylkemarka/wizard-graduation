import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, endTurn } from './helpers/lab.js';

// The enemy-attack "Incoming" math bar (2026-06-02) renders a chip-per-layer
// breakdown of the enemy's swing under the intent box. A clean `vite build`
// does NOT catch a render-time crash in that new branch, so we click through
// real combat: end turns until the enemy telegraphs an attack, then confirm
// the Incoming band appears with its base + net-to-pool chips intact.
const BIRDSEED = 'cv2-l-birdseed';

test('Enemy attack surfaces the Incoming math bar without crashing combat', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 7 });
  for (let i = 0; i < 10; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'Loom Familiar');

  // Drive turns until the enemy telegraphs an attack (the band only renders
  // for attack / attack-multi intents). A handful of end-turns is plenty.
  let shown = false;
  for (let i = 0; i < 8; i++) {
    if (await page.getByText('Incoming', { exact: true }).count() > 0) { shown = true; break; }
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
  }
  expect(shown).toBeTruthy();

  // The band carries the base swing and the net-to-pool punchline chip.
  // (2026-06-06: emoji glyphs replaced by SVG icons — assert on the text.)
  await expect(page.getByText(/(base )?\d+ × \d+ hits|base \d+/).first()).toBeVisible();
  await expect(page.getByText(/\d+ to (HP|Composure)/).first()).toBeVisible();

  // Combat is still alive — nothing crashed.
  await expect(page.getByTestId('hand')).toBeVisible();
});
