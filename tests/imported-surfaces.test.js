import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { CollisionWorld, FIXED_STEP } from '../src/physics.js';
import { Player } from '../src/player.js';
import { bakeCollisionGeometry } from '../src/collision-geometry.js';

test('quantized imported positions are expanded before baking world transforms', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Int16BufferAttribute([-32767, 0, -32767, 32767, 0, -32767, 0, 0, 32767], 3, true),
  );
  const mesh = new THREE.Mesh(geometry);
  const transform = new THREE.Matrix4().makeTranslation(8, 5, -12);
  const baked = bakeCollisionGeometry(mesh, transform);
  baked.computeBoundingBox();
  assert.deepEqual(baked.boundingBox.min.toArray(), [7, 5, -13]);
  assert.deepEqual(baked.boundingBox.max.toArray(), [9, 5, -11]);
  assert.ok(baked.attributes.position.array instanceof Float32Array);
  assert.equal(geometry.attributes.position.getX(0), -1);
  baked.boundsTree = new MeshBVH(baked);
  const collision = new CollisionWorld([
    { type: 'mesh', geometry: baked, inverse: new THREE.Matrix4(), material: 'cloth' },
  ]);
  const hit = collision.cast(new THREE.Vector3(8, 7, -12), new THREE.Vector3(0, -1, 0), 4);
  assert.equal(hit.point.y, 5);
});

function box(position, scale) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry());
  mesh.position.fromArray(position);
  mesh.scale.fromArray(scale);
  mesh.updateMatrix();
  return { type: 'box', inverse: mesh.matrix.clone().invert(), material: 'floor' };
}

test('floor contact cannot overwrite an adjacent wall normal', () => {
  const collision = new CollisionWorld([
    box([0, -0.2, 0], [40, 0.4, 48]),
    box([0, 9, 24.2], [40.4, 18, 0.4]),
  ]);
  const player = new Player(collision);
  const input = { yaw: 0, vertical: -1, horizontal: 0, jumpQueued: false };
  for (let tick = 0; tick < 400; tick++) player.step(FIXED_STEP, input);
  assert.ok(player.normal.z < -0.9);
  input.vertical = 1;
  for (let tick = 0; tick < 120; tick++) player.step(FIXED_STEP, input);
  assert.ok(player.position.y > 1);
});

test('imported triangle collision returns world distance and oriented normal', () => {
  const geometry = new THREE.BoxGeometry(2, 0.4, 3);
  geometry.translate(0, 1, 0);
  geometry.boundsTree = new MeshBVH(geometry);
  const collision = new CollisionWorld([
    { type: 'mesh', geometry, inverse: new THREE.Matrix4(), material: 'cloth' },
  ]);
  const hit = collision.cast(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, -1, 0), 5);
  assert.ok(Math.abs(hit.distance - 1.8) < 0.00001);
  assert.ok(hit.normal.y > 0.99);
  assert.equal(hit.solid.material, 'cloth');
});
