import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  const report = await page.evaluate(async () => {
    const { game, follow, camera, player, world } = window.gameTest;
    const THREE = await import('/node_modules/three/build/three.module.js');
    game.setPhase('paused');
    follow.update = () => {};
    camera.position.set(-2, 10, -4);
    camera.lookAt(4.2, 4.4, -8.4);
    document.querySelectorAll('.panel').forEach((node) => node.classList.add('hidden'));
    const samples = [];
    const down = new THREE.Vector3(0, -1, 0);
    for (const [name, point] of world.human.joints) {
      if (!/DEF-(upper_arm|forearm|hand)R/.test(name)) continue;
      const hit = player.collision.cast(new THREE.Vector3(point.x, 9, point.z), down, 12);
      samples.push({
        name,
        joint: point.toArray(),
        material: hit?.solid.material,
        surface: hit?.point.toArray(),
      });
    }
    return samples;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/hand-review.png' });
  await fs.writeFile('artifacts/hand-review.json', JSON.stringify(report, null, 2));
  assert.equal(report.length, 5);
  assert.ok(
    report.every((sample) => sample.material === 'skin'),
    'the full right arm is uncovered',
  );
  console.log('PASS Chrome: shoulder, forearm and hand remain exposed');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
