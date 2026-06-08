// Kangaroo pouch (Alan bug, 2026-06-08): ducking into the pouch ends the
// turn and must block ALL damage on the immediately-following enemy turn.
// The ability set React state then called endTurn() in the same tick, so the
// enemy turn read the stale pouchGuard (false) and hit the player anyway.
// Fixed via pouchGuardRef. This asserts the real outcome: HP is untouched by
// the enemy turn the pouch is meant to absorb.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const EUCALYPTUS = 'cv2-l-eucalyptus'; // summons a Kangaroo next turn

async function playerHp(page) {
  return Number(await page.getByTestId('player-hp').getAttribute('data-hp'));
}

test('ducking into the kangaroo pouch blocks the next enemy turn', async ({ page }) => {
  // Silk Wraith telegraphs a 9-to-HP maul (and never pops a steal modal).
  await gotoLab(page, 'handler', { seed: 5 });
  for (let i = 0; i < 6; i++) await addCard(page, EUCALYPTUS);
  await fightEnemy(page, 'Silk Wraith');

  // Get a Eucalyptus into hand and play it.
  let played = false;
  for (let t = 0; t < 6 && !played; t++) {
    const c = handCardById(page, EUCALYPTUS).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') {
      await c.click();
      played = true;
      break;
    }
    await endTurn(page);
    const ack = page.getByRole('button', { name: 'Acknowledged' });
    if ((await ack.count()) > 0) await ack.click();
  }
  expect(played).toBeTruthy();

  // End the turn so the Kangaroo arrives.
  await endTurn(page);
  const ack = page.getByRole('button', { name: 'Acknowledged' });
  if ((await ack.count()) > 0) await ack.click();

  // Sanity: the enemy is telegraphing damage to HP this turn.
  await expect(page.getByText(/to HP/i).first()).toBeVisible();
  const hpBefore = await playerHp(page);

  // Click the on-board Kangaroo to duck into the pouch — spends 2 energy and
  // ends the turn, so the enemy turn that follows must deal NO damage.
  const kangaroo = page.locator('[data-testid="board-animal"][data-animal-id="kangaroo"]').first();
  await expect(kangaroo).toBeVisible();
  await kangaroo.click();

  // A transient toast announces the absorbed turn (the log line buries fast).
  await expect(page.getByTestId('pouch-notice')).toBeVisible();

  // After the enemy turn resolves, HP is untouched. (Before the fix the stale
  // guard let the 9-damage maul through.) Poll until the turn settles.
  await expect(page.getByTestId('player-hp')).toHaveAttribute('data-hp', String(hpBefore));
  // And confirm we genuinely advanced past the enemy turn back to the player's.
  await expect(page.getByTestId('end-turn')).toBeEnabled();
  expect(await playerHp(page)).toBe(hpBefore);
});
