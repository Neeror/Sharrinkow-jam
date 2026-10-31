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
      const p = new THREE.Vector3(-0.997720565795898, 0.16200000000000006, -7.677452699290197);
      const data = [];
      for (const [i, solid] of world.solids.entries()) {
        if (solid.name !== 'bed') continue;
        const local = p.clone().applyMatrix4(solid.inverse);
        const before = p.clone();
        const { CollisionWorld } = await import('/src/physics.js');
        const collision = new CollisionWorld([solid]);
        collision.resolveSphere(before, 0.16);
        const closest = solid.geometry?.boundsTree.closestPointToPoint(local);
        data.push({
          i,
          type: solid.type,
          inside: solid.geometry ? player.collision.containsPoint(solid, local) : null,
          closest: closest?.distance,
          corrected: before.toArray(),
          bounds: solid.geometry?.boundingBox,
          hits: solid.geometry?.boundsTree
            .raycast(
              new THREE.Ray(local.clone(), new THREE.Vector3(0.823, 0.371, 0.429).normalize()),
              THREE.DoubleSide,
            )
            .map((h) => ({
              distance: h.distance,
              point: h.point.toArray(),
              normal: h.face.normal.toArray(),
            })),
          inBounds: solid.geometry?.boundingBox.containsPoint(local),
        });
      }
      return data;
    }),
  );
} finally {
  await browser.close();
}
