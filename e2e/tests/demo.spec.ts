import { expect, test } from '@playwright/test';

const widgetFrame = (page: import('@playwright/test').Page) => page.frameLocator('iframe[title="widget under test"]');

test('demo widget completes the handshake and renders mocked metrics', async ({ page }) => {
  await page.goto('/');
  const frame = widgetFrame(page);
  await expect(frame.locator('#value')).toHaveText('12,840');
  await expect(frame.locator('#status')).toContainText('Monthly active users');
  await expect(page.locator('.trace-row').filter({ hasText: 'ui/initialize' }).first()).toBeVisible();
  // first render comes from the host's tool-result; Refresh is the widget's own tools/call
  await expect(page.locator('.trace-row').filter({ hasText: 'tools/call' })).toHaveCount(0);
  await widgetFrame(page).getByRole('button', { name: 'Refresh' }).click();
  await expect(page.locator('.trace-row').filter({ hasText: 'tools/call' }).first()).toBeVisible();
  // SDK handshake completes and nothing the widget sent was rejected
  await expect(page.locator('.trace-row').filter({ hasText: 'ui/notifications/initialized' })).toHaveCount(1);
  await expect(page.locator('.trace-row.invalid')).toHaveCount(0);
});

test('host plays the originating tool call: initialized → tool-input → tool-result', async ({ page }) => {
  await page.goto('/');
  await expect(widgetFrame(page).locator('#value')).toHaveText('12,840');
  const methods = await page.locator('.trace-row .method').allTextContents();
  const at = (m: string) => methods.indexOf(m);
  expect(at('ui/notifications/initialized')).toBeGreaterThanOrEqual(0);
  expect(at('ui/notifications/tool-input')).toBeGreaterThan(at('ui/notifications/initialized'));
  expect(at('ui/notifications/tool-result')).toBeGreaterThan(at('ui/notifications/tool-input'));
});

test('cancelled scenario shows the cancellation reason', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Scenario').selectOption('cancelled');
  await expect(widgetFrame(page).locator('#status')).toContainText('cancelled: user stopped the response');
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
