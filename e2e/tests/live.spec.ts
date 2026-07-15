import { expect, test } from '@playwright/test';

test('live scenario renders the widget served by the real MCP example server', async ({ page }) => {
  await page.goto('/');
  const frame = page.frameLocator('iframe[title="widget under test"]');
  await expect(frame.locator('#value')).toHaveText('12,840');

  await page.getByLabel('Scenario').selectOption('live');

  // Widget HTML now comes from resources/read; tool call is proxied over streamable HTTP.
  await expect(frame.locator('.label')).toHaveText('KPI · example-server');
  await expect(frame.locator('#value')).toHaveText('12,840');
  await expect(frame.locator('#status')).toContainText('Monthly active users');
});
