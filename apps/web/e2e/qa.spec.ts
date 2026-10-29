import { test, expect, type Page } from '@playwright/test';

const ROUTES = ['/', '/login', '/dashboard', '/decisions', '/audit', '/trust', '/roi', '/data', '/settings/policies'];
const VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`no horizontal scroll: ${route} @ ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      expect(await hasHorizontalScroll(page)).toBe(false);
    });
  }
}

test('mobile menu opens, traps focus, and closes on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');

  await page.getByRole('button', { name: 'Open menu' }).click();
  const drawer = page.getByRole('dialog', { name: 'Navigation menu' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('link', { name: 'Decisions' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
});

test('custom 404 renders for a bad URL', async ({ page }) => {
  const response = await page.goto('/this-route-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/dashboard');
});
