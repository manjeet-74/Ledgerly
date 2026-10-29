import { test, expect } from '@playwright/test';

test('demo golden path: landing -> dashboard -> decision evidence -> audit verify', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ledgerly' })).toBeVisible();

  await page.getByRole('link', { name: 'Open Demo' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const firstDecisionLink = page.locator('a[href^="/decisions/"]').first();
  await expect(firstDecisionLink).toBeVisible({ timeout: 15_000 });
  await firstDecisionLink.click();

  await expect(page).toHaveURL(/\/decisions\/.+/);
  await expect(page.getByRole('tab', { name: /Evidence/ })).toHaveAttribute('aria-selected', 'true');

  // Anomaly decisions have exactly 5 evidence steps, budget-shift decisions have 11 -- the
  // spec's requirement is "at least 5 for every kind," so assert the floor, not an exact count.
  const evidenceRows = page.locator('ol > li');
  await expect(evidenceRows.first()).toBeVisible({ timeout: 15_000 });
  await expect(async () => {
    expect(await evidenceRows.count()).toBeGreaterThanOrEqual(5);
  }).toPass({ timeout: 15_000 });

  await page.goto('/audit');
  await page.getByRole('button', { name: 'Verify chain' }).click();
  await expect(page.getByRole('status')).toContainText('Chain verified OK', { timeout: 15_000 });
});
