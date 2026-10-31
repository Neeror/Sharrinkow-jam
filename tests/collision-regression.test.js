import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { CollisionWorld, PLAYER_RADIUS } from '../src/physics.js';
import { Player } from '../src/player.js';
import { FollowCamera } from '../src/camera.js';

function box(position, size) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion(),
    new THREE.Vector3(...size),
  );
  return { type: 'box', inverse: matrix.invert(), material: 'wood' };
}

test('indexed BVH expels a sphere through the nearest outward face', () => {
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  geometry.computeBoundingBox();
  geometry.boundsTree = new MeshBVH(geometry);
  const world = new CollisionWorld([
    { type: 'mesh', closed: true, geometry, inverse: new THREE.Matrix4() },
  ]);
  for (const axis of ['x', 'y', 'z']) {
    for (const sign of [-1, 1]) {
      const position = new THREE.Vector3();
      position[axis] = sign * 0.9;
      assert.ok(world.resolveSphere(position, 0.16));
      assert.ok(sign * position[axis] >= 1.16);
    }
  }
});

test('respawn inside a box is corrected before interpolation', () => {
  const player = new Player(new CollisionWorld([box([0, 1, 0], [2, 2, 2])]));
  player.reset(new THREE.Vector3(0, 1.9, 0));
  assert.ok(player.position.y >= 2 + PLAYER_RADIUS);
  assert.ok(player.previous.equals(player.position));
  assert.ok(player.renderPosition.equals(player.position));
});

test('jump cooldown cannot disable a thin wall collision', () => {
  const player = new Player(new CollisionWorld([box([0, 1, -0.3], [2, 2, 0.05])]));
  player.reset(new THREE.Vector3(0, 1, 0));
  player.grounded = false;
  player.jumpCooldown = 0.28;
  player.velocity.set(0, 0, -40);
  player.step(1 / 120, { yaw: 0, vertical: 0, horizontal: 0 });
  assert.ok(player.position.z >= -0.275 + PLAYER_RADIUS - 0.001);
});

test('camera rotation is immediate and independent of frame duration', () => {
  const player = { renderPosition: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0) };
  const input = { yaw: 1, pitch: 0.6 };
  const a = new THREE.PerspectiveCamera();
  const b = new THREE.PerspectiveCamera();
  new FollowCamera(a, new CollisionWorld([])).update(player, input, 1 / 30);
  new FollowCamera(b, new CollisionWorld([])).update(player, input, 1 / 144);
  assert.ok(a.quaternion.angleTo(b.quaternion) < 1e-7);
  const expected = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.6, -1, 0, 'YXZ'));
  assert.ok(a.quaternion.angleTo(expected) < 1e-7);
});
