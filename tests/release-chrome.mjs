import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${process.argv[2]}/?debug&test-controls`);
  await page.getByRole('button', { name: 'Начать ночь' }).waitFor({ timeout: 90000 });
  await page.keyboard.press('F3');
  assert.equal(await page.locator('#debug-controls').count(), 0);
  assert.equal(await page.evaluate(() => typeof window.gameTest), 'undefined');
  assert.equal(await page.evaluate(() => typeof window.gameDiagnostics), 'undefined');
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Продолжить ↗' }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS Google Chrome release: game starts, pause works, debug globals and F3 tools unavailable',
  );
} finally {
  await browser.close();
}
