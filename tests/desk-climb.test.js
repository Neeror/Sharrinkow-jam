import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeDeskColliders } from '../src/desk-colliders.js';
import { Player } from '../src/player.js';
import { CollisionWorld } from '../src/physics.js';

function world() {
  const transform = new THREE.Matrix4().makeScale(1 / 0.15, 1 / 0.15, 1 / 0.15);
  const floor = {
    type: 'box',
    material: 'floor',
    inverse: new THREE.Matrix4().makeScale(40, 0.4, 48).setPosition(0, -0.2, 0).invert(),
  };
  return new CollisionWorld([floor, ...makeDeskColliders(transform)]);
}

test('W climbs the measured desk front leg and drawers to the tabletop', () => {
  const player = new Player(world());
  player.reset(new THREE.Vector3(-0.73 / 0.15, 0.162, 4));
  let highest = 0;
  for (let tick = 0; tick < 1800; tick++) {
    player.step(1 / 120, { yaw: 0, vertical: 1, horizontal: 0 });
    highest = Math.max(highest, player.position.y);
    if (player.position.y > 5.4) break;
  }
  assert.ok(highest > 5.4, `only climbed to ${highest}`);
});

test('the central knee opening remains walkable beneath the tabletop', () => {
  const player = new Player(world());
  player.reset(new THREE.Vector3(0, 0.162, 4));
  for (let tick = 0; tick < 240; tick++) {
    player.step(1 / 120, { yaw: 0, vertical: 1, horizontal: 0 });
    assert.ok(player.position.y < 0.17);
  }
  assert.ok(player.position.z < 1);
});

test('W stays upward across the old wall-angle threshold and D stays screen-right', () => {
  const collision = new CollisionWorld([
    {
      type: 'box',
      material: 'wood',
      inverse: new THREE.Matrix4().makeScale(20, 20, 1).setPosition(0, 10, -0.5).invert(),
    },
  ]);
  for (const yaw of [-0.5, -0.35, 0, 0.35, 0.5]) {
    for (const horizontal of [0, 1]) {
      const player = new Player(collision);
      player.reset(new THREE.Vector3(0, 5, 0.162));
      player.normal.set(0, 0, 1);
      player.facing.set(0, 1, 0);
      for (let tick = 0; tick < 60; tick++) {
        player.step(1 / 120, { yaw, vertical: 1 - horizontal, horizontal });
      }
      assert.ok(horizontal ? player.position.x > 0.5 : player.position.y > 5.5);
      assert.ok(player.normal.z > 0.99);
    }
  }
});
