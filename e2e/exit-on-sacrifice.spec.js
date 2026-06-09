// Handler v3, slice 3 — exit-on-sacrifice (Alan, 2026-06-08). Sacrificing an
// animal now ALSO fires its own onExit bonus, on top of the existing
// sacrifice-for-Block reward. Sacrifice becomes the way a player deliberately
// CASHES an animal's exit payoff. This pins the additive stacking: a Field
// Mouse (attack 2, onExit { block: 3, healComp: 2 }) sacrificed via the pill
// grants +2 Block (its attack, the always-available sacrifice) PLUS +3 Block
// from its onExit, and heals composure by the onExit's +2.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const GREENS = 'cv2-l-tender-greens'; // summons field-mouse / rabbit / young-buck

test('sacrificing a Field Mouse fires its onExit (block + composure heal) on top of the Block payoff', async ({ page }) => {
  // forceSpecies pins the random small-land pool pick to the Field Mouse so the
  // exit payload is deterministic.
  await gotoLab(page, 'handler', { seed: 1, forceSpecies: 'field-mouse' });
  await addCard(page, GREENS);
  await fightEnemy(page, 'Silk Wraith');

  // Stage the lure, end the turn so the Field Mouse arrives.
  for (let t = 0; t < 4; t++) {
    const c = handCardById(page, GREENS).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); break; }
    await endTurn(page);
    const a = page.getByRole('button', { name: 'Acknowledged' }); if ((await a.count()) > 0) await a.click();
  }
  await endTurn(page); // mouse transforms in
  { const a = page.getByRole('button', { name: 'Acknowledged' }); if ((await a.count()) > 0) await a.click(); }

  const mouse = page.locator('[data-testid="board-animal"][data-animal-id="field-mouse"]').first();
  await expect(mouse).toBeVisible();

  // The sacrifice pill must preview the exit payoff it will cash (block 3,
  // composure 2) — discoverability for the new stacking.
  const sac = mouse.getByTestId('sacrifice-animal').first();
  await expect(sac).toBeVisible();
  await expect(sac).toHaveAttribute('title', /exit bonus.*🛡3.*💟2/);
  await expect(sac).toContainText(/exit .*🛡3/);

  // Read Block + Composure before sacrifice, live (robust to brace / wraith
  // chip). The Silk Wraith whispers at the player's composure, so it sits below
  // max — leaving room for the onExit heal to land observably.
  const blockEl = page.getByTestId('player-block');
  const compEl = page.getByTestId('player-composure');
  const blockBefore = Number(await blockEl.getAttribute('data-block'));
  const compBefore = Number(await compEl.getAttribute('data-composure'));

  await sac.click();

  // Block gained = attack (2, the always-available sacrifice) + onExit block (3).
  // The +3 is the proof the exit bonus fired on sacrifice (was absent pre-slice-3).
  await expect.poll(async () => Number(await blockEl.getAttribute('data-block'))).toBe(blockBefore + 5);

  // The onExit composure heal (+2) also fired — additive, on top of the Block.
  await expect.poll(async () => Number(await compEl.getAttribute('data-composure'))).toBe(compBefore + 2);
});
