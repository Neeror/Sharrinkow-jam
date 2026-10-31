import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const page = await browser.newPage();
  await page.goto(process.argv[2]);
  await page.waitForFunction(() => window.gameDiagnostics);
  const report = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { Assets } = await import('/src/assets.js');
    const { makeModelWorld } = await import('/src/model-world.js');
    const { CollisionWorld } = await import('/src/physics.js');
    const { Player } = await import('/src/player.js');
    const world = makeModelWorld(new THREE.Scene(), await new Assets().load());
    const collision = new CollisionWorld(world.solids);
    const desk = world.models.get('desk');
    const ray = new THREE.Raycaster();
    const origin = new THREE.Vector3();
    const down = new THREE.Vector3(0, -1, 0);
    const samples = [];
    for (let z = -18; z <= -15.5; z += 0.1) {
      for (let x = -14; x <= -12; x += 0.1) {
        origin.set(x, 0.2, z);
        ray.set(origin.clone().multiplyScalar(0.15), new THREE.Vector3(0, 1, 0));
        const actual = ray.intersectObject(desk, true)[0];
        const hit = collision.cast(origin, new THREE.Vector3(0, 1, 0), 6);
        if (actual && actual.distance / 0.15 < 1) {
          samples.push({ x, z, actual: actual.distance / 0.15, shell: hit?.distance });
        }
      }
    }
    const runs = [];
    for (const x of [-14.8, -14, -13.5, -13, -12.5]) {
      const player = new Player(collision);
      player.reset(new THREE.Vector3(x, 0.16, -15));
      const input = { yaw: 0, horizontal: 0, vertical: 1 };
      const steps = [];
      for (let i = 0; i < 120 * 8; i++) {
        player.step(1 / 120, input);
        if (i % 120 === 0)
          steps.push({ position: player.position.toArray(), normal: player.normal.toArray() });
      }
      runs.push({ x, steps });
    }
    return { samples, runs };
  });
  await fs.writeFile('artifacts/desk-probe.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
