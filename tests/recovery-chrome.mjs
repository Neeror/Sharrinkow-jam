import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const page = await browser.newPage();
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest);
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.evaluate(() => {
    const { player, input } = window.gameTest;
    player.safePosition.set(-7, 0.162, 21);
    player.position.set(-15.4, 1, 6);
    window.gameTest.game.setPhase('playing');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    window.gameTest.game.step(1 / 120, window.gameTest.world);
  });
  await page.waitForTimeout(100);
  const result = await page.evaluate(() => window.gameDiagnostics(false));
  assert.ok(Math.abs(result.position[0] + 7) < 0.1);
  assert.ok(Math.abs(result.position[2] - 21) < 0.1);
  assert.ok(result.position[1] >= 0.16);
  console.log('PASS Chrome R restores safe position without floor penetration');
} finally {
  await browser.close();
}
