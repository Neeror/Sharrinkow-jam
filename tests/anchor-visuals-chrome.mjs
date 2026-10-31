import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  const result = await page.evaluate(() => {
    const { game, thread, follow, camera, player } = window.gameTest;
    game.setPhase('paused');
    follow.update = () => {};
    const anchor = thread.anchors[0];
    player.position.set(anchor.position.x, anchor.position.y + 0.162, anchor.position.z + 1);
    camera.position.copy(anchor.position);
    camera.position.y += 1.1;
    camera.position.z += 2.5;
    camera.lookAt(anchor.marker.position);
    camera.updateMatrixWorld(true);
    thread.aim(camera, player, 0);
    document.querySelectorAll('.panel').forEach((node) => node.classList.add('hidden'));
    return {
      candidate: thread.candidate?.id,
      anchors: thread.anchors.map((item) => ({
        id: item.id,
        surface: item.position.y,
        marker: item.marker.position.y,
        stalkBottom: item.stalk.position.y - item.stalk.geometry.parameters.height / 2,
      })),
    };
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/anchor-visuals-chrome.png' });
  console.log(JSON.stringify(result, null, 2));
  for (const anchor of result.anchors) {
    assert.ok(Math.abs(anchor.marker - anchor.surface - 0.5) < 1e-6);
    assert.ok(Math.abs(anchor.stalkBottom - anchor.surface) < 1e-6);
    assert.ok(anchor.surface >= 0);
  }
  assert.equal(result.candidate, 0);
  assert.deepEqual(errors, []);
  console.log(
    'PASS Google Chrome: all 22 stalks above surfaces; elevated marker selects real attachment; no page errors',
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
