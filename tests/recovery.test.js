import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { CollisionWorld } from '../src/physics.js';

test('overlapping bed shell and floor recover above the floor with sphere clearance', () => {
  const geometry = new THREE.BoxGeometry(3, 1.3, 3).translate(0, 0.7, 0);
  geometry.computeBoundingBox();
  geometry.boundsTree = new MeshBVH(geometry);
  const shell = { type: 'mesh', closed: true, geometry, inverse: new THREE.Matrix4() };
  const floor = {
    type: 'box',
    material: 'floor',
    inverse: new THREE.Matrix4().makeScale(40, 0.4, 48).setPosition(0, -0.2, 0).invert(),
  };
  const collision = new CollisionWorld([shell, floor]);
  const position = new THREE.Vector3(0, 0.162, 0);
  collision.resolveSphere(position, 0.16);
  assert.ok(position.y >= 0.16);
  assert.equal(collision.isInsideSolid(position), false);
  assert.equal(collision.hasSphereClearance(position, 0.16), true);
});
