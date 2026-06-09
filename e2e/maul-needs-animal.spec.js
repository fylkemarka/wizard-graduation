// v3 (Alan, 2026-06-09): animal-targeting enemy intents (maul, freeze/"Pins",
// betray, turn-against) must NEVER fire with no summoned animal on the board.
// Garth Maul (escalatingMaul) is the clean probe: every turn it mauls — but on
// an empty board it should drop the maul and just attack, and pick the maul back
// up once an animal is out.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const OATS = 'cv2-l-bag-of-oats';

async function ack(page) {
  const a = page.getByRole('button', { name: 'Acknowledged' }); if ((await a.count()) > 0) await a.click();
}

test('Garth Maul does not maul an empty board, but mauls once an animal is out', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 5 });
  for (let i = 0; i < 4; i++) await addCard(page, OATS);
  await fightEnemy(page, 'Garth Maul');

  // Combat start: board is empty, so the telegraphed intent must NOT be a maul.
  await expect(page.getByTestId('hand')).toBeVisible();
  await expect(page.getByText(/🦷/)).toHaveCount(0);

  // Summon the Ox; end the turn so it arrives and the NEXT intent is rolled with
  // an animal on the board.
  const oats = handCardById(page, OATS).first();
  if ((await oats.getAttribute('data-playable')) === 'true') await oats.click();
  await endTurn(page); await ack(page);
  await expect(page.locator('[data-testid="board-animal"][data-animal-id="ox"]').first()).toBeVisible();

  // Now there IS an animal — Garth Maul telegraphs a maul again.
  await expect(page.getByText(/🦷/).first()).toBeVisible();
});
