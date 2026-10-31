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
        const { world, player } = window.gameTest;
        const cover = world.solids.find((solid) => solid.name === 'cover');
        const geometry = cover.geometry;
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        const c = new THREE.Vector3();
        let inverted = 0;
        let degenerate = 0;
        let steep = 0;
        for (let i = 0; i < geometry.index.count; i += 3) {
          a.fromBufferAttribute(geometry.attributes.position, geometry.index.getX(i));
          b.fromBufferAttribute(geometry.attributes.position, geometry.index.getX(i + 1));
          c.fromBufferAttribute(geometry.attributes.position, geometry.index.getX(i + 2));
          const normal = b.clone().sub(a).cross(c.clone().sub(a));
          if (normal.lengthSq() < 0.0001) degenerate++;
          if (normal.y < -0.0001) inverted++;
          if (Math.abs(normal.y) < normal.length() * 0.2) steep++;
        }
        const start = new THREE.Vector3(5.1683, 3.9739, 0.4584);
        const end = new THREE.Vector3(-1, 3.0277, -4);
        const forward = end.clone().sub(start).setY(0).normalize();
        const hits = [];
        for (let distance = 0; distance < 7.5; distance += 0.35) {
          const origin = start.clone().addScaledVector(forward, distance).setY(9);
          const hit = player.collision.cast(origin, new THREE.Vector3(0, -1, 0), 9);
          hits.push({
            distance: Number(distance.toFixed(2)),
            x: Number(origin.x.toFixed(2)),
            z: Number(origin.z.toFixed(2)),
            y: hit?.point.y,
            solid: hit?.solid?.name || hit?.solid?.material,
          });
        }
        const peaks = [];
        world.human.root.traverse((object) => {
          if (!object.isMesh) return;
          const local = new THREE.Vector3();
          let maximum = -Infinity;
          for (let i = 0; i < object.geometry.attributes.position.count; i++) {
            object.getVertexPosition(i, local);
            local.applyMatrix4(object.matrixWorld);
            world.root.worldToLocal(local);
            if (local.z < -8.6 || local.z > 2) continue;
            maximum = Math.max(maximum, local.y);
          }
          peaks.push({ name: object.name, maximum });
        });
        return { inverted, degenerate, steep, triangles: geometry.index.count / 3, hits, peaks };
      }),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
