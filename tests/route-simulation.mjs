import * as THREE from 'three';
import fs from 'node:fs/promises';
import { makeWorld } from '../src/world.js';
import { CollisionWorld } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Route, makeAnchors } from '../src/route.js';
import { Thread } from '../src/rope.js';
import { HumanThreat } from '../src/threat.js';
import { Enemies } from '../src/enemies.js';

const world = makeWorld(new THREE.Scene());
const player = new Player(new CollisionWorld(world.solids));
const route = new Route(world.builder.scene);
const anchors = makeAnchors(world.builder.scene, world.materials);
const thread = new Thread(world.builder.scene, anchors, player.collision);
const threat = new HumanThreat(world.builder.scene, world.materials.skin);
const enemies = new Enemies(world);
const input = {
  yaw: 0,
  horizontal: 0,
  vertical: 0,
  sneak: false,
  sprint: false,
  jumpQueued: false,
};
const detours = {
  1: [
    [-8.8, 0.16, -4.7],
    [-14.9, 0.16, -5.7],
  ],
  2: [
    [-14.2, 0.16, -5],
    [-13, 0.16, -16.8],
    [-13, 4, -16.8],
    [-13, 4, -15.7],
    [-13, 4.8, -15.7],
  ],
  3: [
    [-3.5, 0.16, -18],
    [-3, 0.16, -21.9],
    [11.7, 0.16, -21.9],
    [11.7, 0.16, -11.5],
  ],
  4: [
    [18, 0.16, 9],
    [16.9, 0.16, 9],
    [16.6, 4, 9],
  ],
  5: [
    [10.8, 3.76, 8],
    [10.8, 0.16, 5.7],
    [6, 0.16, 5.8],
    [6, 3.8, 4.8],
  ],
  8: [
    [2, 4.8, -6.5],
    [4.7, 5.4, -6.5],
    [7.5, 5, -6.5],
  ],
};
let routeIndex = -1;
let detourIndex = 0;
let lastProgress = 0;
let previous = player.position.clone();
let stuck = 0;
const logs = [];
for (let i = 0; i < 120 * 450; i++) {
  const time = i / 120;
  if (i % 18 === 0) {
    if (route.index !== routeIndex) {
      routeIndex = route.index;
      detourIndex = 0;
      lastProgress = time;
      logs.push({ event: 'route', route: routeIndex, time, position: player.position.toArray() });
    }
    const detour = detours[route.index]?.[detourIndex];
    const target = detour || route.target.toArray();
    const dx = target[0] - player.position.x;
    const dy = target[1] - player.position.y;
    const dz = target[2] - player.position.z;
    if (detour && Math.hypot(dx, dz) < 0.45 && Math.abs(dy) < 0.45) {
      detourIndex++;
      lastProgress = time;
    }
    const close =
      !detour && Math.hypot(dx, dy, dz) < 0.85 && Math.abs(dy) < 0.4 && player.normal.y > 0.45;
    input.vertical =
      close ||
      (enemies.lampOn &&
        player.position.y > 2.8 &&
        Math.hypot(player.position.x - 14, player.position.z - 9) < 5.5)
        ? 0
        : 1;
    input.sneak = route.index >= 6;
    input.thread = false;
    input.reel = input.thread;
    thread.candidate = anchors[18 + Math.max(0, Math.min(3, route.index - 8))];
    input.yaw = Math.atan2(dx, -dz);
    if (Math.abs(player.normal.y) < 0.4 && Math.abs(dy) > 0.05) {
      input.yaw = Math.atan2(-player.normal.x, player.normal.z);
      input.vertical = dy > 0 ? 1 : -1;
    }
    if (dy < -1 && player.normal.y < -0.5) input.jumpQueued = true;
    stuck = player.position.distanceTo(previous) < 0.02 && input.vertical ? stuck + 1 : 0;
    if (stuck > 12) {
      input.jumpQueued = true;
      stuck = 0;
    }
    previous.copy(player.position);
    if (i % 600 === 0)
      logs.push({
        time,
        route: route.index,
        detourIndex,
        position: player.position.toArray(),
        normal: player.normal.toArray(),
        noise: threat.noise,
      });
  }
  world.update(time, player.position, threat.noise);
  player.step(1 / 120, input, enemies.wind, Boolean(thread.anchor));
  thread.step(1 / 120, player, input, enemies.wind);
  threat.update(1 / 120, player, time, route.current.zone);
  enemies.update(1 / 120, time, player, threat, route.current.zone, false);
  route.update(1 / 120, player);
  if (route.completed || threat.reason || enemies.reason || time - lastProgress > 35) {
    logs.push({
      final: true,
      time,
      route: route.index,
      position: player.position.toArray(),
      normal: player.normal.toArray(),
      reason: threat.reason || enemies.reason,
      won: route.completed,
    });
    break;
  }
}
await fs.writeFile('artifacts/route-simulation.json', JSON.stringify(logs, null, 2));
console.log(JSON.stringify(logs));
