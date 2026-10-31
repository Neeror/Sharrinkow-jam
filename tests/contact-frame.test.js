import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CollisionWorld } from '../src/physics.js';
import { Player } from '../src/player.js';

test('support contact preserves tangent position on aligned upper faces', () => {
  const player = new Player(new CollisionWorld([]));
  player.position.set(3, 0.2, 4);
  player.contact(
    {
      point: new THREE.Vector3(2.8, 0, 3.9),
      normal: new THREE.Vector3(0, 1, 0),
      solid: { material: 'cloth', type: 'mesh' },
    },
    true,
  );
  assert.equal(player.position.x, 3);
  assert.equal(player.position.z, 4);
  assert.equal(player.position.y, 0.16);
});
