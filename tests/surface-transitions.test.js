import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CollisionWorld, FIXED_STEP } from '../src/physics.js';
import { Player } from '../src/player.js';

function box(position, scale) {
  const mesh = new THREE.Mesh();
  mesh.position.fromArray(position);
  mesh.scale.fromArray(scale);
  mesh.updateMatrix();
  return { mesh, inverse: mesh.matrix.clone().invert(), type: 'box', material: 'wood' };
}

for (const cadence of [1, 7, 18, 23, 31]) {
  test(`table leg, underside and rim remain traversable with input every ${cadence} ticks`, () => {
    const solids = [
      box([0, -0.3, 0], [40, 0.6, 48]),
      box([-9, 4.4, -19], [10, 0.4, 6]),
      box([-13, 2.1, -16.8], [0.5, 4.2, 0.5]),
    ];
    const player = new Player(new CollisionWorld(solids));
    player.reset(new THREE.Vector3(-13, 0.16, -15.8));
    const input = { yaw: 0, vertical: 1, horizontal: 0, sprint: false, sneak: false };
    const targets = [
      [-13, 4, -16.8],
      [-13, 4, -15.7],
      [-13, 4.8, -15.7],
      [-9, 4.76, -18],
    ];
    let index = 0;
    let fellAfterClimb = false;
    let climbed = false;
    for (let tick = 0; tick < 2400; tick++) {
      if (tick % cadence === 0) {
        const target = targets[index];
        const dx = target[0] - player.position.x;
        const dy = target[1] - player.position.y;
        const dz = target[2] - player.position.z;
        if (Math.hypot(dx, dz) < 0.45 && Math.abs(dy) < 0.45) {
          index++;
          if (index === targets.length) break;
        }
        input.yaw = Math.atan2(dx, -dz);
        input.vertical = 1;
        if (Math.abs(player.normal.y) < 0.4 && Math.abs(dy) > 0.4) {
          input.yaw = Math.atan2(-player.normal.x, player.normal.z);
          input.vertical = dy > 0 ? 1 : -1;
        }
      }
      player.step(FIXED_STEP, input);
      climbed ||= player.position.y > 3.5;
      fellAfterClimb ||= climbed && player.position.y < 3;
    }
    assert.equal(fellAfterClimb, false, `lost adhesion at ${player.position.toArray()}`);
    assert.equal(index, targets.length, `stuck at waypoint ${index}: ${player.position.toArray()}`);
    assert.ok(player.position.y > 4.5);
  });
}
