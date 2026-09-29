import { expect, test } from '@playwright/test';

test('live scenario renders the widget served by the real MCP example server', async ({ page }) => {
  await page.goto('/');
  const frame = page.frameLocator('iframe[title="widget under test"]');
  await expect(frame.locator('#value')).toHaveText('12,840');

  await page.getByLabel('Scenario').selectOption('live');

  // No mocks in `live`: the value can only come from the linked get_metrics, called on the server over streamable HTTP.
  // (The HTML swap itself is proven by test-server.spec, whose widget differs from the demo.)
  await expect(frame.locator('#value')).toHaveText('12,840');
  await expect(frame.locator('#status')).toContainText('Monthly active users');
  await expect(page.locator('.trace-row').filter({ hasText: 'ui/notifications/tool-result' }).first()).toBeVisible();
  // the widget's own call goes through passthrough too
  await frame.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.locator('.trace-row').filter({ hasText: 'tools/call' }).first()).toBeVisible();
});
