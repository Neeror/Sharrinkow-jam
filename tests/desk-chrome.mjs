import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest);
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.locator('#scene').click({ position: { x: 680, y: 380 } });
  await page.waitForFunction(() => window.gameDiagnostics().phase === 'playing');
  const runs = [];
  for (const x of [-0.73, 0.73]) {
    await page.evaluate((x) => {
      const { player, input, follow } = window.gameTest;
      player.reset(player.position.clone().set(-8.5 + x / 0.15, 0.162, -15));
      input.yaw = 0;
      input.pitch = 0.15;
      follow.ready = false;
    }, x);
    await page.keyboard.down('w');
    await page.waitForFunction(() => window.gameDiagnostics().position[1] > 5.4, {
      timeout: 12000,
    });
    await page.keyboard.up('w');
    await page.waitForTimeout(350);
    runs.push(await page.evaluate(() => window.gameDiagnostics(false)));
    await page.screenshot({ path: `artifacts/desk-climb-${x < 0 ? 'left' : 'right'}.png` });
    assert.ok(runs.at(-1).grounded);
    assert.ok(runs.at(-1).normal[1] > 0.9);
  }
  const movements = [];
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (const key of ['w', 'a', 's', 'd']) {
      await page.evaluate((yaw) => {
        const { player, input, follow } = window.gameTest;
        player.reset(player.position.clone().set(0, 0.162, 19));
        input.yaw = yaw;
        follow.ready = false;
      }, yaw);
      const before = await page.evaluate(() => window.gameDiagnostics().position);
      await page.keyboard.down(key);
      await page.waitForTimeout(300);
      await page.keyboard.up(key);
      const after = await page.evaluate(() => window.gameDiagnostics().position);
      const forward = [Math.sin(yaw), -Math.cos(yaw)];
      const right = [Math.cos(yaw), Math.sin(yaw)];
      const expected =
        key === 'w'
          ? forward
          : key === 's'
            ? forward.map((v) => -v)
            : key === 'd'
              ? right
              : right.map((v) => -v);
      const projection =
        (after[0] - before[0]) * expected[0] + (after[2] - before[2]) * expected[1];
      assert.ok(projection > 0.12, `${key} at yaw ${yaw}: ${projection}`);
      movements.push({ yaw, key, projection });
    }
  }
  await page.keyboard.press('F3');
  await page.screenshot({ path: 'artifacts/desk-controls-debug.png' });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'artifacts/desk-controls.json',
    JSON.stringify({ runs, movements, errors }, null, 2),
  );
  console.log(
    'PASS Chrome: both front legs to tabletop with real W input; WASD at four camera headings; no page errors',
  );
} finally {
  await browser.close();
}
