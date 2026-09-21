import { expect, test } from '@playwright/test';
import { CLI_TOKEN, CLI_URL } from '../playwright.config.js';

const widgetFrame = (page: import('@playwright/test').Page) => page.frameLocator('iframe[title="widget under test"]');

test('CLI rejects requests without a valid token', async ({ page }) => {
  const noToken = await page.goto(`${CLI_URL}/`);
  expect(noToken?.status()).toBe(401);
  const badToken = await page.goto(`${CLI_URL}/?token=${'f'.repeat(32)}`);
  expect(badToken?.status()).toBe(401);
});

test('CLI serves the component library: DataTable and KpiCard with scenarios', async ({ page }) => {
  await page.goto(`${CLI_URL}/?token=${CLI_TOKEN}`);

  // data-table sorts first → active by default
  const frame = widgetFrame(page);
  await expect(frame.locator('.data-table')).toBeVisible();
  await expect(frame.locator('td').filter({ hasText: 'Ann' })).toBeVisible();

  await page.getByLabel('Widget').selectOption('kpi-card');
  await expect(frame.locator('.kpi-card__value')).toHaveText('12,840');

  await page.getByLabel('Scenario').selectOption('error');
  await expect(frame.locator('.kpi-card__status')).toContainText('Metrics backend unavailable');
});

test('CLI-served empty scenario shows the DataTable empty state', async ({ page }) => {
  await page.goto(`${CLI_URL}/?token=${CLI_TOKEN}`);
  await page.getByLabel('Scenario').selectOption('empty');
  await expect(widgetFrame(page).locator('.data-table__message')).toHaveText('No rows.');
});
