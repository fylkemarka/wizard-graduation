import { test, expect } from '@playwright/test';
import { gotoLab, endTurn } from './helpers/lab.js';

const WEAVER = 'Hollow Weaver';

// Reads the player's current Composure from the combat HUD. The value lives in
// a span titled "Composure — verbal HP ..." (the enemy's composure span has a
// different title), so this targets the player's number specifically.
async function readComposure(page) {
  const el = page.locator('[title*="verbal HP"]').first();
  const txt = await el.innerText();
  const m = txt.match(/(\d+)\s*\/\s*\d+/);
  return m ? Number(m[1]) : null;
}

// v3.4.81 lane-agnostic Weave: the Hollow Weaver stacks "weave debt" on the
// player; at the end of your NEXT turn it fires as composure damage UNLESS you
// dealt damage to it that turn. Here the Handler plays nothing — no lures means
// no animals means the Weaver is never hit — so any accrued debt MUST fire.
// This drives the new App.jsx weave-fire block (it previously had a handler-only
// immediate-fire branch) to prove the path runs without crashing combat.
test('Weave fires as composure damage on a turn you never hit the Weaver (handler)', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 3 });
  await page.getByRole('button', { name: /Enter Combat/ }).click();
  await expect(page.getByRole('heading', { name: /Pick an Enemy/ })).toBeVisible();
  await page.getByRole('button', { name: WEAVER, exact: false }).first().click();
  await expect(page.getByTestId('hand')).toBeVisible();

  let firedDrop = false;
  for (let turn = 0; turn < 10 && !firedDrop; turn++) {
    const chip = page.getByText(/🪡 Weave \d+/);
    if ((await chip.count()) > 0) {
      const before = await readComposure(page);
      await endTurn(page);
      // Combat must survive the weave fire + the enemy's follow-up turn.
      await expect(page.getByTestId('hand')).toBeVisible();
      const after = await readComposure(page);
      if (after != null && before != null && after < before) firedDrop = true;
    } else {
      await endTurn(page);
      await expect(page.getByTestId('hand')).toBeVisible();
    }
  }

  expect(firedDrop).toBe(true);
});
