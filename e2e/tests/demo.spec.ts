import { expect, test } from '@playwright/test';

const widgetFrame = (page: import('@playwright/test').Page) => page.frameLocator('iframe[title="widget under test"]');

test('demo widget completes the handshake and renders mocked metrics', async ({ page }) => {
  await page.goto('/');
  const frame = widgetFrame(page);
  await expect(frame.locator('#value')).toHaveText('12,840');
  await expect(frame.locator('#status')).toContainText('Monthly active users');
  await expect(page.locator('.trace-row').filter({ hasText: 'ui/initialize' }).first()).toBeVisible();
  await expect(page.locator('.trace-row').filter({ hasText: 'tools/call' }).first()).toBeVisible();
});

test('error scenario surfaces the tool error inside the widget', async ({ page }) => {
  await page.goto('/');
  await expect(widgetFrame(page).locator('#value')).toHaveText('12,840');
  await page.getByLabel('Scenario').selectOption('error');
  const frame = widgetFrame(page);
  await expect(frame.locator('#status')).toContainText('Metrics backend unavailable');
  await expect(frame.locator('#value')).toHaveText('—');
});

test('theme switch pushes host-context-changed into the sandboxed iframe', async ({ page }) => {
  await page.goto('/');
  const frame = widgetFrame(page);
  await expect(frame.locator('#value')).toHaveText('12,840');
  await expect(frame.locator('body')).not.toHaveClass(/dark/);
  await page.getByLabel('Theme').selectOption('dark');
  await expect(frame.locator('body')).toHaveClass(/dark/);
  await expect(page.locator('.trace-row').filter({ hasText: 'host-context-changed' }).first()).toBeVisible();
});

test('trace rows expand to JSON payloads and clear resets the log', async ({ page }) => {
  await page.goto('/');
  const row = page.locator('.trace-row').filter({ hasText: 'ui/initialize' }).first();
  await row.locator('summary').click();
  await expect(row.locator('pre')).toContainText('"jsonrpc"');
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.locator('.trace-row')).toHaveCount(0);
  await expect(page.locator('.trace-empty')).toBeVisible();
});
