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
    const { Player } = await import('/src/player.js');
    const { Thread } = await import('/src/rope.js');
    const { CollisionWorld } = await import('/src/physics.js');
    const { world } = window.gameTest;
    const cases = [];
    for (const name of ['bed', 'sofa', 'desk', 'shelves', 'lamp', 'human', 'cover']) {
      const solid = world.solids.find((item) => item.name === name);
      if (!solid) throw new Error(`Missing collider ${name}`);
      const collision = new CollisionWorld([solid]);
      const matrix = solid.inverse.clone().invert();
      const bounds =
        solid.type === 'box'
          ? new THREE.Box3(
              new THREE.Vector3(-0.5, -0.5, -0.5),
              new THREE.Vector3(0.5, 0.5, 0.5),
            ).applyMatrix4(matrix)
          : solid.geometry.boundingBox.clone().applyMatrix4(matrix);
      let hit = null;
      for (let ix = 1; ix < 5 && !hit; ix++) {
        for (let iz = 1; iz < 5 && !hit; iz++) {
          const origin = new THREE.Vector3(
            THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, ix / 5),
            bounds.max.y + 2,
            THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, iz / 5),
          );
          hit = collision.cast(
            origin,
            new THREE.Vector3(0, -1, 0),
            bounds.max.y - bounds.min.y + 4,
          );
        }
      }
      if (!hit) throw new Error(`No surface ${name}`);
      const point = hit.point.clone();
      const normal = hit.normal.clone();
      const player = new Player(collision);
      player.reset(point.clone().addScaledVector(normal, 2));
      player.renderPosition.copy(player.position);
      const thread = new Thread(new THREE.Scene(), [], collision);
      thread.candidate = { position: point };
      thread.step(1 / 120, player, { thread: true, reel: true });
      const attached = Boolean(thread.anchor);
      const initial = player.position.distanceTo(point);
      for (let tick = 0; tick < 80; tick++)
        thread.step(1 / 120, player, { thread: true, reel: true });
      player.renderPosition.copy(player.position);
      thread.render(player);
      const vertices = thread.geometry.attributes.position;
      const centers = [];
      for (let i = 0; i < thread.rope.count; i++) {
        const center = new THREE.Vector3();
        for (let j = 0; j < 5; j++)
          center.add(new THREE.Vector3().fromBufferAttribute(vertices, i * 5 + j));
        centers.push(center.multiplyScalar(0.2));
      }
      const first = centers[0];
      const last = centers.at(-1);
      const expected = player.renderPosition
        .clone()
        .add(new THREE.Vector3(-0.13, 0.035, 0).applyQuaternion(player.orientation));
      let deviation = 0;
      for (let i = 0; i < centers.length; i++)
        deviation = Math.max(
          deviation,
          centers[i].distanceTo(first.clone().lerp(last, i / (centers.length - 1))),
        );
      const rendered = thread.mesh.visible;
      thread.step(1 / 120, player, { thread: false });
      cases.push({
        name,
        attached,
        rendered,
        releaseHidden: !thread.mesh.visible,
        initial,
        final: player.position.distanceTo(point),
        startError: first.distanceTo(expected),
        endError: last.distanceTo(point),
        deviation,
      });
      thread.mesh.geometry.dispose();
      thread.mesh.material.dispose();
    }
    return cases;
  });
  await fs.writeFile(
    'artifacts/rope-render-chrome.json',
    JSON.stringify({ report, errors }, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  for (const result of report) {
    assert.ok(result.attached && result.rendered && result.releaseHidden, result.name);
    assert.ok(result.final < result.initial, `${result.name}: reel approaches anchor`);
    assert.ok(
      result.startError < 0.00001 && result.endError < 0.00001,
      `${result.name}: endpoints`,
    );
    assert.ok(result.deviation < 0.05, `${result.name}: no white arc`);
  }
} finally {
  await browser.close();
}
