import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  console.log(
    JSON.stringify(
      await page.evaluate(async () => {
        const THREE = await import('/node_modules/three/build/three.module.js');
        const { ROUTE } = await import('/src/route.js');
        const { player } = window.gameTest;
        return ROUTE.map((route, i) => {
          const p = new THREE.Vector3(...route.position);
          const corrected = p.clone();
          player.collision.resolveSphere(corrected, 0.16);
          return {
            i,
            target: p.toArray(),
            corrected: corrected.toArray(),
            inside: player.collision.isInsideSolid(p),
            clearance: player.collision.hasSphereClearance(p, 0.15),
          };
        });
      }),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
