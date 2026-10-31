import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${process.argv[2]}/?debug`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Сцена укуса' }).click();
  await page.waitForFunction(() => window.gameTest.ending.active);
  await page.evaluate(() => {
    const { ending } = window.gameTest;
    window.timelineUpdate = ending.update.bind(ending);
    ending.update = () => false;
  });
  const samples = [];
  for (const time of [0.1, 1, 2.6, 3.4, 3.79, 3.85, 4.2, 5.5, 6.3]) {
    samples.push(
      await page.evaluate(async (time) => {
        const THREE = await import('/node_modules/three/build/three.module.js');
        const { ending, camera, thread, collisionDebug, route } = window.gameTest;
        ending.time = time;
        window.timelineUpdate(0);
        camera.updateMatrixWorld(true);
        const screen = ending.spider.group.position.clone().project(camera);
        const hidden = (node) =>
          !node || getComputedStyle(node).display === 'none' || node.classList.contains('hidden');
        return {
          time,
          screen: screen.toArray(),
          position: ending.spider.group.position.toArray(),
          camera: camera.position.toArray(),
          markersHidden: thread.anchors.every(
            (anchor) => !anchor.marker.visible && !anchor.stalk.visible,
          ),
          debugHidden:
            !collisionDebug.group.visible && hidden(document.getElementById('debug-controls')),
          routeHidden: !route.marker.visible,
          headerHidden: hidden(document.querySelector('header')),
          phase: window.gameDiagnostics().phase,
        };
      }, time),
    );
    await page.waitForTimeout(100);
    await page.screenshot({ path: `artifacts/ending-frame-${String(time).replace('.', '-')}.png` });
  }
  await fs.writeFile(
    'artifacts/ending-timeline.json',
    JSON.stringify({ samples, errors }, null, 2),
  );
  for (const sample of samples) {
    assert.ok(sample.position.every(Number.isFinite) && sample.camera.every(Number.isFinite));
    assert.ok(
      sample.markersHidden && sample.debugHidden && sample.routeHidden && sample.headerHidden,
      `helpers hidden at ${sample.time}`,
    );
    assert.ok(
      Math.abs(sample.screen[0]) < 0.9 &&
        Math.abs(sample.screen[1]) < 0.9 &&
        sample.screen[2] > -1 &&
        sample.screen[2] < 1,
      `spider in frame at ${sample.time}`,
    );
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ samples, errors }, null, 2));
} finally {
  await browser.close();
}
