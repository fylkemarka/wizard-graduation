// Regression (Alan, 2026-06-09): the intent bar names the specific maul victim,
// but projectedMaulVictim referenced effAnimalAttack — which lives in the
// V2SpellTray sub-component, out of scope in the main CombatScreen. On a
// COMPOSURE maul (the branch that used it) the intent bar threw
// "Can't find variable: effAnimalAttack" and errored the player out. Garth Maul
// alternates HP/composure mauls every turn, so surviving several of its turns
// with an animal on the board exercises BOTH pools' victim projection.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const OATS = 'cv2-l-bag-of-oats';   // Drystone Ox — a persistent body for the maul to name
const GREENS = 'cv2-l-tender-greens';

async function ack(page) {
  const a = page.getByRole('button', { name: 'Acknowledged' }); if ((await a.count()) > 0) await a.click();
}
async function ensurePlay(page, cardId, maxTurns = 6) {
  for (let t = 0; t < maxTurns; t++) {
    const c = handCardById(page, cardId).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); return true; }
    await endTurn(page); await ack(page);
  }
  return false;
}

test('the maul intent bar names the victim across HP AND composure mauls without crashing', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 5 });
  await addCard(page, OATS);
  for (let i = 0; i < 6; i++) await addCard(page, GREENS);
  await fightEnemy(page, 'Garth Maul'); // every attack is a maul, alternating HP/composure

  // Put a couple of bodies out (the Ox + whatever Greens summons).
  expect(await ensurePlay(page, OATS)).toBeTruthy();
  await ensurePlay(page, GREENS);
  await endTurn(page); await ack(page);

  // Survive several Garth Maul turns. The intent bar projects the victim every
  // turn (alternating pool), and the "🦷 will maul …" line must render without
  // throwing — the page (hand) stays alive throughout.
  let sawVictimLine = false;
  for (let t = 0; t < 6; t++) {
    await expect(page.getByTestId('hand')).toBeVisible();       // no render crash
    if ((await page.getByText(/🦷 will maul/).count()) > 0) sawVictimLine = true;
    await endTurn(page); await ack(page);
  }
  await expect(page.getByTestId('hand')).toBeVisible();
  expect(sawVictimLine).toBeTruthy();                            // the named-victim line rendered
});
