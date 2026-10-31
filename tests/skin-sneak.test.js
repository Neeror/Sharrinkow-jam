import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CollisionWorld } from '../src/physics.js';
import { Player } from '../src/player.js';

function armWorld() {
  return new CollisionWorld([
    {
      type: 'box',
      material: 'skin',
      inverse: new THREE.Matrix4().makeScale(1, 0.5, 3).setPosition(0, 2, 0).invert(),
    },
  ]);
}

test('sneaking on skin does not automatically start an edge descent', () => {
  const player = new Player(armWorld());
  player.reset(new THREE.Vector3(0.4, 2.412, 0));
  player.material = 'skin';
  player.step(1 / 120, { yaw: Math.PI / 2, vertical: 1, horizontal: 0, sneak: true });
  assert.equal(player.rappelling, false);
});

test('explicit Q still starts descent from skin', () => {
  const player = new Player(armWorld());
  player.reset(new THREE.Vector3(0.4, 2.412, 0));
  player.material = 'skin';
  player.step(1 / 120, { yaw: Math.PI / 2, vertical: 1, horizontal: 0, descend: true });
  assert.equal(player.rappelling, true);
});
