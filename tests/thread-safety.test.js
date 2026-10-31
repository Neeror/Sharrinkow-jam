import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CollisionWorld } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Thread } from '../src/rope.js';

function floor() {
  return {
    type: 'box',
    material: 'floor',
    inverse: new THREE.Matrix4().makeScale(40, 0.4, 48).setPosition(0, -0.2, 0).invert(),
  };
}

test('thread rejects an anchor below the floor before applying a correction', () => {
  const world = new CollisionWorld([floor()]);
  const player = new Player(world);
  player.reset(new THREE.Vector3(0, 0.162, 0));
  const thread = new Thread(new THREE.Scene(), [], world);
  thread.anchor = { position: new THREE.Vector3(0, -1, 0) };
  thread.held = true;
  thread.length = 0.1;
  thread.step(1 / 120, player, { thread: true, reel: true });
  assert.equal(thread.anchor, null);
  assert.ok(player.position.y >= 0.16);
});

test('thread cannot reel through a blocking solid to a hidden anchor', () => {
  const wall = {
    type: 'box',
    material: 'wood',
    inverse: new THREE.Matrix4().makeScale(2, 2, 0.1).setPosition(0, 1, -1).invert(),
  };
  const world = new CollisionWorld([floor(), wall]);
  const player = new Player(world);
  player.reset(new THREE.Vector3(0, 1, 0));
  const thread = new Thread(new THREE.Scene(), [], world);
  thread.anchor = { position: new THREE.Vector3(0, 1, -2) };
  thread.held = true;
  thread.length = 0.45;
  thread.step(1 / 120, player, { thread: true, reel: true });
  assert.equal(thread.anchor, null);
  assert.equal(player.position.z, 0);
});

test('valid floor attachment stops above its real surface while reeling', () => {
  const world = new CollisionWorld([floor()]);
  const player = new Player(world);
  player.reset(new THREE.Vector3(0, 2, 0));
  const thread = new Thread(new THREE.Scene(), [], world);
  thread.anchor = { position: new THREE.Vector3(0, 0, 0) };
  thread.held = true;
  thread.length = 2;
  for (let i = 0; i < 600; i++) thread.step(1 / 120, player, { thread: true, reel: true });
  assert.ok(player.position.y >= 0.16);
  assert.ok(player.position.y < 0.6);
});
