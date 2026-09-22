import { expect, test } from '@playwright/test';

test('a live session is saved as an offline scenario that replays the same data', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Scenario').selectOption('live');
  const frame = page.frameLocator('iframe[title="widget under test"]');
  await expect(frame.locator('#value')).toHaveText('12,840');
  await frame.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.locator('.trace-row').filter({ hasText: 'tools/call' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Save scenario' }).click();

  await expect(page.getByLabel('Scenario')).toHaveValue('recorded-1');
  const snippet = page.getByTestId('scenario-snippet');
  await expect(snippet).toContainText('"recorded-1"');
  await expect(snippet).toContainText('"toolCall"');
  await expect(snippet).toContainText('"get_metrics"');
  // replayed from the recording: the lifecycle result renders without a server round trip
  await expect(frame.locator('#value')).toHaveText('12,840');
  await expect(page.getByRole('button', { name: 'Save scenario' })).toHaveCount(0);
});
