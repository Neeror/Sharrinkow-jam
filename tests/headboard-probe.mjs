import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  console.log(
    await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { player, world } = window.gameTest;
      const results = [];
      for (const x of [-1.8, -0.5, 2, 3]) {
        player.reset(new THREE.Vector3(x, 0.162, -15));
        const targets = [
          [x, 5.35, -13.45],
          [2, 5.35, -13.3],
          [3, 4.18, -11.5],
        ];
        const samples = [];
        for (const target of targets) {
          for (let i = 0; i < 1800; i++) {
            world.update(0);
            const dx = target[0] - player.position.x;
            const dz = target[2] - player.position.z;
            const dy = target[1] - player.position.y;
            if (Math.hypot(dx, dz) < 0.4 && Math.abs(dy) < 0.5) break;
            let yaw = Math.atan2(dx, -dz);
            let vertical = 1;
            if (Math.abs(player.normal.y) < 0.4 && Math.abs(dy) > 0.05) {
              yaw = Math.atan2(-player.normal.x, player.normal.z);
              vertical = dy > 0 ? 1 : -1;
            }
            player.step(1 / 120, { yaw, pitch: 0.2, vertical, horizontal: 0 });
          }
          samples.push(player.position.toArray());
        }
        results.push({ x, samples });
      }
      return JSON.stringify(results);
    }),
  );
} finally {
  await browser.close();
}
