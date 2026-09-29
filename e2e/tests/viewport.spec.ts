import { expect, type Page, test } from '@playwright/test';

const iframe = (page: Page) => page.locator('iframe[title="widget under test"]');

async function box(page: Page) {
  const b = await iframe(page).boundingBox();
  if (!b) throw new Error('iframe not laid out');
  return { width: Math.round(b.width), height: Math.round(b.height) };
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  // the KPI demo reports { width: 328, height: 190 } through size-changed
  await expect(page.frameLocator('iframe[title="widget under test"]').locator('#value')).toHaveText('12,840');
});

test('inline frame takes the column width and the height the widget reported', async ({ page }) => {
  await expect.poll(() => box(page)).toEqual({ width: 640, height: 190 });
});

test('fullscreen fills the canvas minus the gutter', async ({ page }) => {
  await page.getByLabel('Display').selectOption('fullscreen');
  const canvas = await page.locator('main.canvas').boundingBox();
  if (!canvas) throw new Error('no canvas');
  await expect
    .poll(() => box(page))
    .toEqual({ width: Math.round(canvas.width) - 32, height: Math.round(canvas.height) - 32 });
});

test('pip is a small floating box', async ({ page }) => {
  await page.getByLabel('Display').selectOption('pip');
  await expect.poll(async () => (await box(page)).width).toBe(360);
  await expect(page.getByTestId('viewport')).toHaveClass(/viewport--pip/);
});

test('mobile preset narrows the column and reaches the widget', async ({ page }) => {
  await page.getByLabel('Device').selectOption('mobile');
  await expect.poll(async () => (await box(page)).width).toBe(375);
  const row = page.locator('.trace-row').filter({ hasText: 'host-context-changed' }).last();
  await row.locator('summary').click();
  await expect(row.locator('pre')).toContainText('"platform": "mobile"');
});
