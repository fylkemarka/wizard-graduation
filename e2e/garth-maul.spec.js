// Garth Maul (Alan, 2026-06-08): summoner-only Act 1 normal whose every
// attack is a maul, escalating and alternating pool — 4 HP, 4 comp, 5 HP,
// 5 comp, … The escalatingMaul flag drives a deterministic rollIntent
// sequence; this pins that the intent alternates pool turn-to-turn and the
// fight doesn't crash.

import { test, expect } from '@playwright/test';
import { gotoLab, fightEnemy, endTurn } from './helpers/lab.js';

test('Garth Maul alternates HP/composure mauls turn to turn', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1 });
  await fightEnemy(page, 'Garth Maul');

  const intentText = () => page.getByText(/🦷/).first().innerText();

  // Turn 1: an HP maul (⚔).
  const t1 = await intentText();
  expect(t1).toMatch(/🦷/);
  expect(t1).toMatch(/⚔/); // HP pool first

  // Turn 2: a composure maul (🎭) — pool alternated.
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();
  const t2 = await intentText();
  expect(t2).toMatch(/🎭/);

  // Turn 3: back to an HP maul, and combat is still alive.
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();
  await expect(page.getByText(/🦷/).first()).toBeVisible();
});
