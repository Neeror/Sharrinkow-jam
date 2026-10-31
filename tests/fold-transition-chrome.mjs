import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { Player } = await import('/src/player.js');
    const { world, player: existing } = window.gameTest;
    const player = new Player(existing.collision);
    player.reset(new THREE.Vector3(5.1683, 3.9739, 0.4584));
    const logs = [];
    const flips = [];
    const contact = player.contact.bind(player);
    player.contact = (hit, preserveTangent) => {
      if (hit.normal.y < -0.4 && player.normal.y > 0.1)
        flips.push({
          before: player.position.toArray(),
          previousNormal: player.normal.toArray(),
          point: hit.point.toArray(),
          normal: hit.normal.toArray(),
          preserveTangent,
          stack: new Error().stack,
        });
      return contact(hit, preserveTangent);
    };
    const target = new THREE.Vector3(2, 3.55, -4.5);
    for (let tick = 0; tick < 1200; tick++) {
      const d = target.clone().sub(player.position);
      const input = {
        yaw: Math.atan2(d.x, -d.z),
        pitch: 0.2,
        vertical: 1,
        horizontal: 0,
        sneak: false,
      };
      const before = player.position.clone();
      player.step(1 / 120, input);
      if (tick % 60 !== 0) continue;
      const direction = d.setY(0).normalize();
      const hit = existing.collision.cast(player.position, direction, 0.4);
      logs.push({
        tick,
        p: player.position.toArray(),
        n: player.normal.toArray(),
        v: player.velocity.toArray(),
        move: player.position.distanceTo(before),
        hit: hit && { name: hit.solid.name, normal: hit.normal.toArray(), distance: hit.distance },
      });
    }
    const contacts = world.solids
      .filter((solid) => solid.type === 'mesh')
      .map((solid) => {
        const local = player.position.clone().applyMatrix4(solid.inverse);
        const closest = solid.geometry.boundsTree.closestPointToPoint(local);
        return {
          name: solid.name,
          distance: closest?.distance,
          point: closest?.point.toArray(),
          inside: solid.closed && existing.collision.containsPoint(solid, local),
        };
      })
      .filter((contact) => contact.distance < 0.7);
    return { logs, end: player.position.toArray(), solids: world.solids.length, contacts, flips };
  });
  await fs.writeFile('artifacts/fold-transition.json', JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      {
        end: result.end,
        normals: result.logs.map((log) => log.n),
        flips: result.flips,
        contacts: result.contacts,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
