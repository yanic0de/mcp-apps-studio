import { expect, test } from '@playwright/test';

test('protocol inspector from the test server drives tools through live passthrough', async ({ page }) => {
  await page.goto('/?server=http://127.0.0.1:3200/mcp');
  await page.getByLabel('Scenario').selectOption('live');

  const frame = page.frameLocator('iframe[title="widget under test"]');
  await expect(frame.locator('h1')).toContainText('Protocol Inspector');

  await frame.getByRole('button', { name: 'echo', exact: true }).click();
  await expect(frame.locator('#output')).toContainText('"echoed"');
  await expect(frame.locator('#output')).toContainText('hello from inspector');

  await frame.getByRole('button', { name: 'fail' }).click();
  await expect(frame.locator('#output')).toContainText('Intentional failure');
  // forwarded as the server's CallToolResult, not converted into a JSON-RPC error
  await expect(frame.locator('#output')).toContainText('"isError": true');
  await expect(frame.locator('#output')).toHaveClass('error');

  await frame.getByRole('button', { name: 'rows' }).click();
  await expect(frame.locator('#output')).toContainText('Row 1');
  await expect(frame.locator('#output')).toContainText('"total": 42');

  // every click went through the emulator bridge — visible in the studio trace
  await expect(page.locator('.trace-row').filter({ hasText: 'tools/call' }).first()).toBeVisible();
});

test('counter tool keeps state across calls through the real server', async ({ page }) => {
  await page.goto('/?server=http://127.0.0.1:3200/mcp');
  await page.getByLabel('Scenario').selectOption('live');
  const frame = page.frameLocator('iframe[title="widget under test"]');

  await frame.getByRole('button', { name: 'counter' }).click();
  await expect(frame.locator('#output')).toContainText('"count"');
  const first = Number(/"count": (\d+)/.exec((await frame.locator('#output').textContent()) ?? '')?.[1]);

  await frame.getByRole('button', { name: 'counter' }).click();
  await expect(frame.locator('#output')).toContainText(`"count": ${first + 1}`);
});
