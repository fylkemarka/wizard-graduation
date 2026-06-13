// Scripted-pattern enemies (v3.9) render and resolve their telegraphed rhythm
// without crashing. Button Drone runs a 2-beat GUARD/STRIKE cycle.
import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, endTurn } from './helpers/lab.js';

test('a scripted-pattern enemy cycles its rhythm without crashing', async ({ page }) => {
  await gotoLab(page, 'wit', { seed: 7 });
  await fightEnemy(page, 'Button Drone');
  // Walk several turns — the pattern loops (block beat ↔ strike beat). The
  // intent box should render each beat; combat must stay alive throughout.
  for (let i = 0; i < 5; i++) {
    await expect(page.getByTestId('hand')).toBeVisible();
    await endTurn(page);
  }
  await expect(page.getByTestId('hand')).toBeVisible();
});
