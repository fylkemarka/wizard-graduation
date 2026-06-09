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

test('the sacrifice pill previews the Memorial AoE payoff', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 2, forceSpecies: 'young-buck' });
  await addCard(page, 'c-memorial');
  for (let i = 0; i < 3; i++) await addCard(page, 'cv2-l-tender-greens');
  await fightEnemy(page, 'Silk Wraith');

  // Install Memorial, then summon a Young Buck (a body to sacrifice).
  expect(await ensurePlay(page, 'c-memorial')).toBeTruthy();
  expect(await ensurePlay(page, 'cv2-l-tender-greens')).toBeTruthy();
  await endTurn(page);
  { const a = page.getByRole('button', { name: 'Acknowledged' }); if ((await a.count()) > 0) await a.click(); }

  // With an animal on the board + Memorial installed, the always-available
  // sacrifice pill previews the AoE payoff and names the source in its tooltip,
  // so the player can SEE the sacrifice loop before committing to it.
  const pill = page.getByTestId('sacrifice-animal').first();
  await expect(pill).toBeVisible();
  await expect(pill).toContainText(/💔\s*5 all/);
  await expect(pill).toHaveAttribute('title', /Composure to ALL enemies.*Memorial/);
});
