import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const url = process.env.GAME_URL || process.argv[3];
assert.ok(url, 'Set GAME_URL to the actual Vite listening URL');
const browser = await chromium.launch({
  channel: 'chrome',
  headless: process.argv.includes('--headless'),
});
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(url);
  await page
    .waitForFunction(() => typeof window.gameDiagnostics === 'function')
    .catch((error) => {
      console.log(errors);
      throw error;
    });
  await page.waitForTimeout(2000);
  let diagnostics = await page.evaluate(() => window.gameDiagnostics());
  console.log(JSON.stringify(diagnostics));
  const start = page.getByRole('button', { name: 'Начать ночь' });
  if (await start.isVisible()) {
    await start.click();
    await page.waitForTimeout(800);
    const before = await page.evaluate(() => window.gameDiagnostics());
    if (Number(process.argv[2]) >= 3) {
      await page.evaluate(() => {
        const state = window.gameDiagnostics();
        document.dispatchEvent(
          new MouseEvent('mousemove', {
            buttons: 2,
            movementX: state.yaw / 0.0027,
            movementY: (-0.3 - state.pitch) / 0.0027,
          }),
        );
      });
      await page.waitForTimeout(500);
      const aim = await page.evaluate(() => window.gameDiagnostics());
      console.log('Aim:', JSON.stringify(aim));
      assert.notEqual(aim.candidate, undefined, 'anchor under reticle');
      await page.keyboard.down('e');
      await page.waitForTimeout(250);
      assert.ok((await page.evaluate(() => window.gameDiagnostics())).attached, 'E attaches');
      await page.keyboard.up('e');
      await page.waitForTimeout(100);
      assert.equal((await page.evaluate(() => window.gameDiagnostics())).attached, false);
      await page.waitForTimeout(1000);
    }
    await page.keyboard.down('w');
    await page.waitForTimeout(1000);
    await page.keyboard.up('w');
    diagnostics = await page.evaluate(() => window.gameDiagnostics());
    assert.ok(Math.hypot(...diagnostics.velocity) > 0.8, 'W produces movement');
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    assert.ok(
      (await page.evaluate(() => window.gameDiagnostics())).position[1] >
        diagnostics.position[1] + 0.1,
      'jump leaves surface',
    );
    await page.waitForTimeout(900);
    await page.keyboard.down('s');
    await page.waitForTimeout(4000);
    await page.keyboard.up('s');
    diagnostics = await page.evaluate(() => window.gameDiagnostics());
    console.log('Rear wall state', JSON.stringify(diagnostics));
    await page.evaluate(() => {
      const state = window.gameDiagnostics(false);
      document.dispatchEvent(
        new MouseEvent('mousemove', { buttons: 2, movementX: (state.yaw - Math.PI) / 0.0027 }),
      );
    });
    await page.keyboard.down('w');
    await page.waitForTimeout(1000);
    await page.keyboard.up('w');
    diagnostics = await page.evaluate(() => window.gameDiagnostics());
    assert.ok(diagnostics.normal[2] < -0.8, 'rear wall adhesion while climbing toward wall');
    assert.ok(diagnostics.position[1] > 0.3, 'W climbs attached wall');
    console.log('Movement:', JSON.stringify(diagnostics));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const paused = await page.evaluate(() => window.gameDiagnostics());
    assert.equal(paused.phase, 'paused');
    await page.waitForTimeout(200);
    assert.equal((await page.evaluate(() => window.gameDiagnostics())).time, paused.time);
  }
  await fs.mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: `artifacts/stage-${process.argv[2] || '1'}.png` });
  assert.deepEqual(errors, []);
  console.log(`PASS Chrome ${browser.version()}: stage ${process.argv[2] || '1'}`);
} finally {
  await browser.close();
}
