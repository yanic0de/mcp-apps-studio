import { expect, test } from '@playwright/test';

test('live scenario renders the widget served by the real MCP example server', async ({ page }) => {
  await page.goto('/');
  const frame = page.frameLocator('iframe[title="widget under test"]');
  await expect(frame.locator('#value')).toHaveText('12,840');

  await page.getByLabel('Scenario').selectOption('live');

  // No mocks in `live`: the value can only come from get_metrics proxied over streamable HTTP.
  // (The HTML swap itself is proven by test-server.spec, whose widget differs from the demo.)
  await expect(frame.locator('#value')).toHaveText('12,840');
  await expect(frame.locator('#status')).toContainText('Monthly active users');
  await expect(page.locator('.trace-row').filter({ hasText: 'tools/call' }).first()).toBeVisible();
});
