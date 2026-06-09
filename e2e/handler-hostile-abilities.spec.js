// Handler-hostile enemy abilities (Alan, 2026-06-08): Silence (no new summons),
// Freeze (an animal can't attack), Betrayal (steal an animal as a companion).
// Forced via ?forceIntentKind so they fire deterministically.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const BIRDSEED = 'cv2-l-birdseed';

async function nextTurn(page) {
  await endTurn(page);
  const a = page.getByRole('button', { name: 'Acknowledged' }); if ((await a.count()) > 0) await a.click();
}

test('Silence blocks new summons', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 4, forceIntentKind: 'silence' });
  for (let i = 0; i < 8; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'The Silent Spinner');
  // End turn 1 → the (forced) silence resolves on the enemy's turn.
  await nextTurn(page);
  await expect(page.getByTestId('silenced')).toBeVisible();
  // A birdseed in hand can't be played while silenced — it stays put.
  const seed = handCardById(page, BIRDSEED).first();
  await expect(seed).toBeVisible();
  const before = await handCardById(page, BIRDSEED).count();
  await seed.click();
  await expect(handCardById(page, BIRDSEED)).toHaveCount(before); // not consumed
});

test('Freeze stops an animal attacking', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 4, forceSpecies: 'goose', forceIntentKind: 'freeze' });
  for (let i = 0; i < 8; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'The Pattern-Maker');
  // Stage a lure; the goose arrives at end of turn 1, when the forced freeze
  // resolves on it.
  for (let t = 0; t < 4; t++) {
    const c = handCardById(page, BIRDSEED).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); break; }
    await nextTurn(page);
  }
  await nextTurn(page); // goose arrives + freeze lands
  const goose = page.locator('[data-testid="board-animal"][data-animal-id="goose"]').first();
  await expect(goose).toBeVisible();
  await expect(goose).toContainText(/frozen/i);
});

test('Betrayal marks first (grace turn), then steals an animal as a companion', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 4, forceSpecies: 'goose', forceIntentKind: 'betray' });
  for (let i = 0; i < 8; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'The Spinster Matron');
  await expect(page.getByTestId('companion-panel')).toHaveCount(0);
  for (let t = 0; t < 4; t++) {
    const c = handCardById(page, BIRDSEED).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); break; }
    await nextTurn(page);
  }
  await nextTurn(page); // goose arrives + betray is MARKED (telegraphed, no steal yet)
  await expect(page.getByTestId('betray-pending')).toBeVisible();
  await expect(page.getByTestId('companion-panel')).toHaveCount(0); // not stolen yet
  // Feed the goose so it's still here when the steal resolves — at duration 2 an
  // unfed goose would short-stay and leave before the Matron's next turn.
  await page.locator('[data-testid="feed-species"][data-animal-id="goose"]').first().click();
  await nextTurn(page); // Matron's next turn → the steal resolves
  await expect(page.getByTestId('companion-panel')).toBeVisible();
  await expect(page.getByText(/Turncoat/).first()).toBeVisible();
});
