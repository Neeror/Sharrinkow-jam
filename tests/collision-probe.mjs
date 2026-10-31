import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(process.argv[2]);
  await page.waitForFunction(() => window.gameDiagnostics);
  console.log(
    await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { Assets } = await import('/src/assets.js');
      const { makeModelWorld } = await import('/src/model-world.js');
      const { CollisionWorld } = await import('/src/physics.js');
      const world = makeModelWorld(new THREE.Scene(), await new Assets().load());
      const collision = new CollisionWorld(world.solids);
      return world.solids
        .filter((solid) => solid.type === 'mesh')
        .map((solid) => {
          solid.geometry.computeBoundingBox();
          const bounds = solid.geometry.boundingBox;
          const center = bounds.getCenter(new THREE.Vector3());
          const hit = collision.cast(
            new THREE.Vector3(center.x, 17, center.z),
            new THREE.Vector3(0, -1, 0),
            20,
          );
          return {
            material: solid.material,
            min: bounds.min.toArray(),
            max: bounds.max.toArray(),
            hit: hit && { point: hit.point.toArray(), material: hit.solid.material },
          };
        });
    }),
  );
} finally {
  await browser.close();
}
