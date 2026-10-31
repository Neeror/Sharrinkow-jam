import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  page.on('pageerror', (e) => console.log('ERROR', e.message));
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  const report = await page.evaluate(async () => {
    const { world, player, follow, input, game } = window.gameTest;
    const THREE = await import('/node_modules/three/build/three.module.js');
    const bounds = (object) => {
      const b = new THREE.Box3().setFromObject(object, true);
      return {
        min: b.min.toArray().map((v) => v / 0.15),
        max: b.max.toArray().map((v) => v / 0.15),
      };
    };
    const parts = [];
    world.bed.traverse((o) => {
      if (o.isMesh) parts.push({ name: o.name, ...bounds(o) });
    });
    const joints = [...world.human.joints]
      .filter(([n]) => /head|thigh|foot|hand|spine/i.test(n))
      .map(([name, p]) => ({ name, p: p.toArray() }));
    game.start(true);
    player.reset(new THREE.Vector3(5, 8, -3));
    follow.ready = false;
    input.pitch = 0.6;
    input.yaw = 0;
    return { parts, joints, human: bounds(world.human.root) };
  });
  console.log(JSON.stringify(report, null, 2));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/current-bed.png' });
  await fs.writeFile('artifacts/current-inspect.json', JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
