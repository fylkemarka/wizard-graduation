import { test, expect } from '@playwright/test';
import { enterLabCombat, handCards } from './helpers/lab.js';

// The harness's reason to exist: a clean `vite build` does NOT catch
// render-time crashes in App.jsx (CLAUDE.md). These boot the real app
// through Lab Mode into live combat and fail loudly on any console error
// or React error-boundary trip.

for (const lane of ['handler', 'wit']) {
  test(`${lane}: Lab Mode boots into combat without crashing`, async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(String(err)));

    // The Loom Familiar fight exists in act 1 and is a safe generic target.
    await enterLabCombat(page, { lane, enemy: 'Loom Familiar' });

    // Hand drew at least one card and the End Turn control is live.
    await expect(handCards(page).first()).toBeVisible();
    expect(await handCards(page).count()).toBeGreaterThan(0);
    await expect(page.getByTestId('end-turn')).toBeVisible();

    // No React error boundary, no uncaught console errors.
    await expect(page.getByText(/Something went wrong/i)).toHaveCount(0);
    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });
}
