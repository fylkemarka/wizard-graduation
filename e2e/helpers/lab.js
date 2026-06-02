// Reusable drivers for the in-game Lab Mode. Lab Mode is the deterministic
// way into combat: it skips map/RNG by letting us pick a wizard, hand-build a
// deck, and drop straight into a fight against a chosen enemy. Everything the
// specs need to set up a scenario goes through here.

import { expect } from '@playwright/test';

const CHARACTER_NAME = { wit: 'The Scholar', handler: 'The Handler' };

// Open the app and enter Lab Mode for a lane. Lands on the deck-build screen.
// Pass { seed } to load with `?seed=N`, which swaps Math.random for a seeded
// PRNG (see src/devSeed.js) so shuffles/draws/enemy-intent play out identically.
// Pass { forceSwoop: 'owl' | 'hawk' } to deterministically fire the next
// eligible raptor swoop (consumed once) — see src/devSeed.js / the swoop pre-pass.
export async function gotoLab(page, lane, { seed, forceSwoop, forceMaul, forceSalmonRoll, forceSpecies } = {}) {
  const params = new URLSearchParams();
  if (seed != null) params.set('seed', String(seed));
  if (forceSwoop) params.set('forceSwoop', forceSwoop);
  if (forceMaul) params.set('forceMaul', '1');
  if (forceSalmonRoll) params.set('forceSalmonRoll', forceSalmonRoll);
  if (forceSpecies) params.set('forceSpecies', forceSpecies);
  const qs = params.toString();
  await page.goto(qs ? `/?${qs}` : '/');
  // Boots to the title menu. "Begin the Path" (or "Begin a New Path…" when a
  // save exists) → character select.
  await page.getByRole('button', { name: /^Begin/ }).click();
  await expect(page.getByRole('heading', { name: 'Choose Your Wizard' })).toBeVisible();
  const name = CHARACTER_NAME[lane];
  if (!name) throw new Error(`Unknown lane "${lane}" — expected wit or handler.`);
  // Scope the Lab button to the card carrying this character's name so we
  // don't accidentally hit the wrong lane's button.
  const card = page.locator('div').filter({ has: page.getByRole('heading', { name, exact: true }) }).last();
  await card.getByRole('button', { name: /Lab/ }).click();
  await expect(page.getByRole('heading', { name: /Lab —/ })).toBeVisible();
}

// In the deck-build screen, add a card by its template id (stable across
// lane display-name overrides). Search narrows the pool first so the entry
// is mounted, then we click the entry carrying that id.
export async function addCard(page, cardId) {
  const search = page.getByPlaceholder(/Search name/);
  await search.fill(cardId);
  const entry = page.locator(`[data-testid="pool-card"][data-card-id="${cardId}"]`).first();
  await entry.click();
  await search.fill('');
}

// Leave deck-build → enemy-select, then pick an enemy by name → combat.
export async function fightEnemy(page, enemyName) {
  await page.getByRole('button', { name: /Enter Combat/ }).click();
  await expect(page.getByRole('heading', { name: /Pick an Enemy/ })).toBeVisible();
  await page.getByRole('button', { name: enemyName, exact: false }).first().click();
  // Combat is up once the hand region renders.
  await expect(page.getByTestId('hand')).toBeVisible();
}

// One-shot: lane → optional extra cards → enemy → in combat.
export async function enterLabCombat(page, { lane, cards = [], enemy, seed }) {
  await gotoLab(page, lane, { seed });
  for (const c of cards) await addCard(page, c);
  await fightEnemy(page, enemy);
}

// --- combat-state readers -------------------------------------------------

export function handCards(page) {
  return page.getByTestId('hand-card');
}

export function handCardById(page, cardId) {
  return page.locator(`[data-testid="hand-card"][data-card-id="${cardId}"]`);
}

// Play a card in hand by its id (clicks the first matching, playable or not —
// the caller asserts playability separately when that's the point).
export async function playCardById(page, cardId) {
  await handCardById(page, cardId).first().click();
}

export async function endTurn(page) {
  await page.getByTestId('end-turn').click();
}
