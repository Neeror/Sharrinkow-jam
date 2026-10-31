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
      const runs = [];
      for (const x of [-1, 0, 1, 2, 3, 4]) {
        player.reset(new THREE.Vector3(x, 3.4, -4.5));
        const samples = [];
        for (let i = 0; i < 2400; i++) {
          world.update(0);
          player.step(1 / 120, {
            yaw: 0,
            pitch: -0.35,
            vertical: 1,
            horizontal: 0,
            sneak: false,
            jumpQueued: i % 180 === 0,
          });
          if (i % 240 === 0)
            samples.push({ p: player.position.toArray(), n: player.normal.toArray() });
          if (player.position.z < -11.3) break;
        }
        runs.push({ x, samples, end: player.position.toArray() });
      }
      return JSON.stringify(runs);
    }),
  );
} finally {
  await browser.close();
}
