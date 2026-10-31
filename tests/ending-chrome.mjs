import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${process.argv[2]}/?debug`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Сцена укуса' }).click();
  await page.evaluate(() => {
    window.gameTest.collisionDebug.group.visible = false;
  });
  await page.evaluate(() => {
    const { game } = window.gameTest;
    game.time = 217;
    game.detections = 2;
    game.defeats = 1;
  });
  await page.waitForTimeout(2800);
  await page.screenshot({ path: 'artifacts/ending-approach.png' });
  assert.equal(await page.evaluate(() => window.gameDiagnostics().phase), 'ending');
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => window.gameDiagnostics().phase), 'ending');
  await page.waitForTimeout(1200);
  console.log(
    'ENDING',
    await page.evaluate(() => ({
      state: window.gameDiagnostics(false),
      active: window.gameTest.ending.active,
      errors: document.getElementById('error').textContent,
    })),
    errors,
  );
  await page.screenshot({ path: 'artifacts/ending-bite.png' });
  await page.waitForFunction(() => window.gameDiagnostics().phase === 'won');
  await page.screenshot({ path: 'artifacts/ending-result.png' });
  await page.getByRole('heading', { name: 'Рука цела. Но не совсем.' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('ruka-cela-ending-seen')), '1');
  assert.match(
    await page.locator('#end-detail').textContent(),
    /3:37.*Обнаружений: 2.*Поражений: 1/,
  );
  assert.equal(await page.evaluate(() => localStorage.getItem('ruka-cela-room-best')), null);
  assert.ok(await page.evaluate(() => window.gameDiagnostics(false).audioPeak < 0.001));
  await page.getByRole('button', { name: 'Ещё одна ночь' }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('F3');
  await page.getByRole('button', { name: 'Сцена укуса' }).click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => window.gameDiagnostics().phase), 'ending');
  await page.waitForTimeout(1600);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.gameDiagnostics().phase === 'won');
  await page.getByRole('button', { name: 'В меню', exact: true }).click();
  assert.equal(await page.evaluate(() => window.gameDiagnostics().phase), 'ready');
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'artifacts/ending-check.json',
    JSON.stringify(
      {
        browser: browser.version(),
        errors,
        result: 'passed',
        method: 'debug scene, not full route',
      },
      null,
      2,
    ),
  );
  console.log('PASS Chrome ending, first-view protection, delayed repeat skip, restart and menu');
} finally {
  await browser.close();
}
