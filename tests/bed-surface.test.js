import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bedWalkableSurface } from '../src/bed-surface.js';
import { buildShellCollider } from '../src/colliders.js';
import { CollisionWorld } from '../src/physics.js';
import { Player } from '../src/player.js';

test('pillow shell retains its climbable vertical approach and upper surface', () => {
  const detailed = new THREE.BoxGeometry(3, 2, 3).translate(0, 3.5, 0);
  const shell = buildShellCollider(detailed, 0.2);
  const geometry = bedWalkableSurface(shell);
  const collision = new CollisionWorld([
    {
      type: 'mesh',
      geometry,
      inverse: new THREE.Matrix4(),
      oneSided: true,
      closed: false,
      material: 'cloth',
    },
  ]);
  const side = collision.cast(new THREE.Vector3(0, 3, 2), new THREE.Vector3(0, 0, -1), 2);
  assert.ok(side, 'pillow side must not be filtered away');
  assert.ok(side.normal.z > 0.9);
  const top = collision.cast(new THREE.Vector3(0, 6, 0), new THREE.Vector3(0, -1, 0), 4);
  assert.ok(top && Math.abs(top.point.y - 4.5) < 0.01);
  const player = new Player(collision);
  player.reset(new THREE.Vector3(0, 3, 1.66));
  player.normal.set(0, 0, 1);
  player.facing.set(0, 1, 0);
  let highest = player.position.y;
  for (let i = 0; i < 480; i++) {
    player.step(1 / 120, { yaw: 0, pitch: 0.2, vertical: 1, horizontal: 0 });
    highest = Math.max(highest, player.position.y);
  }
  assert.ok(highest > 4.5, `W climbs to pillow top: ${highest}`);
});
