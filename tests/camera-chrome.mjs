import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: process.argv.includes('--headless'),
});
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.argv[2]);
  await page.waitForFunction(() => window.gameDiagnostics);
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.locator('#scene').click({ position: { x: 680, y: 380 } });
  await page.waitForFunction(() => window.gameDiagnostics().locked);
  const before = await page.evaluate(() => window.gameDiagnostics(false));
  const after = await page.evaluate(() => {
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 50 }));
    return window.gameDiagnostics(false);
  });
  assert.ok(Math.abs(after.yaw - before.yaw - 0.27) < 1e-8);
  assert.ok(Math.abs(after.pitch - before.pitch - 0.135) < 1e-8);
  await page.keyboard.press('F3');
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'artifacts/collision-debug.png' });
  await page.keyboard.press('F3');
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => window.gameDiagnostics().phase === 'paused');
  await page.locator('#sensitivity').fill('1.5');
  await page.locator('#invert-y').check();
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ruka-cela-mouse'))), {
    sensitivity: 1.5,
    invertY: true,
  });
  await page.reload();
  await page.waitForFunction(() => window.gameDiagnostics);
  assert.equal(await page.locator('#sensitivity').inputValue(), '1.5');
  assert.equal(await page.locator('#invert-y').isChecked(), true);
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.locator('#scene').click({ position: { x: 680, y: 380 } });
  await page.waitForFunction(() => window.gameDiagnostics().locked);
  const inverted = await page.evaluate(() => {
    const before = window.gameDiagnostics(false);
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: 10 }));
    const after = window.gameDiagnostics(false);
    return { yaw: after.yaw - before.yaw, pitch: after.pitch - before.pitch };
  });
  assert.ok(Math.abs(inverted.yaw - 0.0405) < 1e-8);
  assert.ok(Math.abs(inverted.pitch + 0.0405) < 1e-8);
  assert.deepEqual(errors, []);
  console.log(
    'PASS Chrome: pointer lock, immediate mouse delta, sensitivity persistence, inverted Y, F3 screenshot; no page errors',
  );
} finally {
  await browser.close();
}
