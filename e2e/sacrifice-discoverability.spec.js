// Sacrifice-discoverability UI (Alan, 2026-06-08): the sacrifice engine was
// invisible — a player couldn't tell that sacrificing (or an animal leaving)
// fires Memorial / Palpable Sadness AoE. The sacrifice pill now previews the
// AoE payoff, and the "🐾 This turn" strip surfaces the passive Memorial exit
// damage so the engine is anticipated, not buried in the log.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

async function ensurePlay(page, cardId, maxTurns = 6) {
  for (let t = 0; t < maxTurns; t++) {
    const c = handCardById(page, cardId).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); return true; }
    await endTurn(page);
    const a = page.getByRole('button', { name: 'Acknowledged' }); if ((await a.count()) > 0) await a.click();
  }
  return false;
}

test('the sacrifice pill previews Memorial AoE; the strip surfaces it', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 2 });
  await addCard(page, 'c-memorial');
  for (let i = 0; i < 3; i++) await addCard(page, 'c-strays');
  await fightEnemy(page, 'Silk Wraith');

  expect(await ensurePlay(page, 'c-memorial')).toBeTruthy();
  expect(await ensurePlay(page, 'c-strays')).toBeTruthy();

  // Strays on the board — the sacrifice pill now shows the AoE rider, and its
  // tooltip names the source.
  const pill = page.getByTestId('sacrifice-animal').first();
  await expect(pill).toBeVisible();
  await expect(pill).toContainText(/💔\s*4 all/);
  await expect(pill).toHaveAttribute('title', /Composure to ALL enemies.*Memorial/);

  // The "This turn" strip surfaces the passive Memorial exit AoE (strays are
  // 1-turn, so they're leaving this turn → projected AoE shown).
  await expect(page.getByText(/Memorial: \d+ comp to all \(\d+ leaving\)/)).toBeVisible();
});
