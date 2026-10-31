import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeAnchors, updateAnchorVisuals, ANCHOR_MARKER_HEIGHT } from '../src/route.js';
import { CollisionWorld } from '../src/physics.js';
import { Thread } from '../src/rope.js';

test('anchor stalk sits above the surface without moving the attachment', () => {
  const material = new THREE.MeshBasicMaterial();
  const anchors = makeAnchors(new THREE.Scene(), { hair: material, glow: material });
  for (const anchor of anchors) {
    anchor.position.set(0, 0, 0);
    updateAnchorVisuals(anchor);
    assert.equal(anchor.position.y, 0);
    assert.equal(anchor.marker.position.y, ANCHOR_MARKER_HEIGHT);
    assert.equal(anchor.stalk.position.y - anchor.stalk.geometry.parameters.height / 2, 0);
  }
});

test('aiming at the elevated marker selects its actual floor attachment', () => {
  const scene = new THREE.Scene();
  const material = new THREE.MeshBasicMaterial();
  const anchor = makeAnchors(scene, { hair: material, glow: material })[0];
  anchor.position.set(0, 0, 0);
  anchor.base = 0;
  updateAnchorVisuals(anchor);
  const collision = new CollisionWorld([
    {
      type: 'box',
      material: 'floor',
      inverse: new THREE.Matrix4().makeScale(40, 0.4, 48).setPosition(0, -0.2, 0).invert(),
    },
  ]);
  const thread = new Thread(scene, [anchor], collision);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
  camera.position.set(0, 0.7, 1.5);
  camera.lookAt(anchor.marker.position);
  camera.updateMatrixWorld(true);
  thread.aim(camera, { position: new THREE.Vector3(0, 0.162, 1) }, 0);
  assert.equal(thread.candidate, anchor);
  assert.equal(anchor.position.y, 0);
  assert.equal(anchor.marker.position.y, ANCHOR_MARKER_HEIGHT);
});
