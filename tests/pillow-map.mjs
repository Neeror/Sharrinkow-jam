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
      const data = [];
      for (let z = -4; z >= -12; z -= 1) {
        const row = [];
        for (let x = 0; x <= 6; x += 1) {
          const hit = player.collision.cast(
            new THREE.Vector3(x, 9, z),
            new THREE.Vector3(0, -1, 0),
            12,
          );
          row.push(hit ? [x, Number(hit.point.y.toFixed(2)), hit.solid.material] : null);
        }
        data.push({ z, row });
      }
      return JSON.stringify({
        data,
        joints: [...world.human.joints].filter(([n]) => /hand|finger|thumb/i.test(n)),
      });
    }),
  );
} finally {
  await browser.close();
}
