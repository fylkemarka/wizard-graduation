// Repro probe (Alan, 2026-06-09): "a 4-dmg card hit for 8 / two -4 floaters from
// ONE play." Sharp Whistle is compDmg:4. Playing it ONCE must drop enemy Composure
// by exactly 4 and spawn exactly one damage floater. If this catches an 8, the
// per-play double-application bug reproduces in the harness; if it always reads 4,
// the double is input-side (a double-firing click) and wants a debounce instead.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById } from './helpers/lab.js';

const WHISTLE = 'c-sharp-whistle';

async function compVal(page) {
  return Number(await page.getByTestId('enemy-composure').getAttribute('data-value'));
}

test('one Sharp Whistle deals exactly 4 composure (not 8)', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 7 });
  for (let i = 0; i < 6; i++) await addCard(page, WHISTLE);
  await fightEnemy(page, 'Silk Wraith');

  await expect(page.getByTestId('enemy-composure')).toBeVisible();
  const before = await compVal(page);

  const card = handCardById(page, WHISTLE).first();
  await expect(card).toHaveAttribute('data-playable', 'true');
  await card.click();

  // Composure settles. Block is 0 (none played), so the full 4 lands.
  await expect.poll(async () => await compVal(page)).toBeLessThan(before);
  const after = await compVal(page);
  expect(before - after).toBe(4);
});
