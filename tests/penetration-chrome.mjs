import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  const report = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { CollisionWorld } = await import('/src/physics.js');
    const { Player } = await import('/src/player.js');
    const { Thread } = await import('/src/rope.js');
    const { world } = window.gameTest;
    const collision = new CollisionWorld(world.solids);
    const player = new Player(collision);
    const ray = new THREE.Ray();
    const direction = new THREE.Vector3(0.823, 0.371, 0.429).normalize();
    const local = new THREE.Vector3();
    const inside = (point, solid) => {
      local.copy(point).applyMatrix4(solid.inverse);
      if (solid.type === 'box')
        return Math.max(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z)) < 0.49999;
      if (solid.type !== 'mesh' || !solid.closed) return false;
      if (!solid.geometry.boundingBox.containsPoint(local)) return false;
      ray.set(local, direction);
      const hits = solid.geometry.boundsTree
        .raycast(ray, THREE.DoubleSide)
        .sort((a, b) => a.distance - b.distance);
      let count = 0;
      let previous = -1;
      for (const hit of hits) {
        if (hit.distance < 0.00001 || hit.distance - previous < 0.00001) continue;
        previous = hit.distance;
        count++;
      }
      return count % 2 === 1;
    };
    const failures = [];
    const counts = {};
    const check = (point, label) => {
      if (point.y < 0.159) failures.push({ label, reason: 'floor', point: point.toArray() });
      for (const solid of world.solids) {
        if (inside(point, solid)) {
          const reason = solid.name || solid.material;
          counts[reason] = (counts[reason] || 0) + 1;
          failures.push({ label, reason, point: point.toArray() });
          break;
        }
      }
    };
    const parts = [];
    for (const solid of world.solids.filter((s) =>
      ['sofa', 'desk', 'shelves', 'lamp', 'bed', 'human', 'cover'].includes(s.name),
    )) {
      const single = new CollisionWorld([solid]);
      const matrix = solid.inverse.clone().invert();
      const bounds =
        solid.type === 'box'
          ? new THREE.Box3(
              new THREE.Vector3(-0.5, -0.5, -0.5),
              new THREE.Vector3(0.5, 0.5, 0.5),
            ).applyMatrix4(matrix)
          : solid.geometry.boundingBox.clone().applyMatrix4(matrix);
      let samples = 0;
      let reels = 0;
      for (let ix = 1; ix <= 4; ix++) {
        for (let iz = 1; iz <= 4; iz++) {
          const origin = new THREE.Vector3(
            THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, ix / 5),
            bounds.max.y + 1,
            THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, iz / 5),
          );
          const hit = single.cast(
            origin,
            new THREE.Vector3(0, -1, 0),
            bounds.max.y - bounds.min.y + 2,
          );
          if (!hit) continue;
          const point = hit.point.clone();
          const normal = hit.normal.clone();
          player.reset(point.clone().addScaledVector(normal, 0.162));
          check(player.position, `${solid.name}:reset`);
          for (let tick = 0; tick < 48; tick++) {
            player.step(1 / 120, {
              yaw: (ix * Math.PI) / 2,
              pitch: 0.2,
              vertical: 1,
              horizontal: 0,
            });
            check(player.position, `${solid.name}:walk`);
          }
          samples++;
          player.reset(point.clone().addScaledVector(normal, 0.8));
          const thread = new Thread(new THREE.Scene(), [], collision);
          thread.anchor = { position: point };
          thread.length = 0.8;
          thread.held = true;
          for (let tick = 0; tick < 72; tick++) {
            thread.step(1 / 120, player, { thread: true, reel: true });
            check(player.position, `${solid.name}:reel`);
          }
          thread.mesh.geometry.dispose();
          thread.mesh.material.dispose();
          reels++;
        }
      }
      parts.push({ name: solid.name, samples, reels });
    }
    return { parts, failures: failures.slice(0, 12), counts, failureCount: failures.length };
  });
  await fs.writeFile(
    'artifacts/penetration-chrome.json',
    JSON.stringify({ browser: browser.version(), errors, ...report }, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  assert.equal(report.failureCount, 0, 'independent ray parity detects penetration');
  assert.ok(
    report.parts.every((part) => part.samples > 0),
    'every collider sampled',
  );
} finally {
  await browser.close();
}
