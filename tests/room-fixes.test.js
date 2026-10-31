import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CollisionWorld, PLAYER_RADIUS } from '../src/physics.js';
import { makeSofaColliders } from '../src/sofa-colliders.js';
import { Player } from '../src/player.js';
import { playerZone } from '../src/location.js';
import { makeBedFrameColliders } from '../src/bed-colliders.js';

const floor = () => ({
  type: 'box',
  material: 'floor',
  inverse: new THREE.Matrix4().makeScale(40, 0.4, 48).setPosition(0, -0.2, 0).invert(),
});

test('sofa underside has a sphere-sized passage rather than a filled shell', () => {
  const world = new CollisionWorld([
    floor(),
    ...makeSofaColliders(new THREE.Matrix4().makeScale(1 / 0.15, 1 / 0.15, 1 / 0.15)),
  ]);
  const player = new Player(world);
  player.reset(new THREE.Vector3(0, 0.162, 4));
  for (let i = 0; i < 600; i++) {
    player.step(1 / 120, { yaw: 0, pitch: 0.15, vertical: 1, horizontal: 0 });
    assert.ok(player.position.y >= 0.159 && player.position.y < 0.18);
  }
  assert.ok(player.position.z < -3.5, player.position.toArray().join(','));
});

test('sphere traversal prevents a fast rope correction crossing a thin floor', () => {
  const world = new CollisionWorld([floor()]);
  const p = new THREE.Vector3(0, 3, 0);
  assert.ok(world.moveSphere(p, new THREE.Vector3(0, -6, 0), PLAYER_RADIUS));
  assert.ok(p.y >= PLAYER_RADIUS);
});

test('deep penetration in each sofa part is expelled', () => {
  for (const solid of makeSofaColliders(new THREE.Matrix4())) {
    const p = new THREE.Vector3().applyMatrix4(solid.inverse.clone().invert());
    const world = new CollisionWorld([solid]);
    assert.ok(world.resolveSphere(p, 0.024));
    const local = p.clone().applyMatrix4(solid.inverse);
    assert.ok(Math.max(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z)) > 0.5);
  }
});

test('Q against the headboard preserves wall climbing above the mattress', () => {
  const world = new CollisionWorld([floor(), ...makeBedFrameColliders()]);
  const player = new Player(world);
  player.reset(new THREE.Vector3(4, 2.187, -12.93));
  player.normal.set(0, 0, 1);
  player.facing.set(0, 1, 0);
  for (let i = 0; i < 90; i++) {
    player.step(1 / 120, { yaw: 0, pitch: 0.15, vertical: 1, horizontal: 0, descend: true });
    assert.equal(player.rappelling, false);
  }
  assert.ok(player.position.y > 3.1, player.position.toArray().join(','));
});

test('HUD location is independent of pending route and excludes under-bed floor', () => {
  const player = { grounded: true, material: 'cloth', position: new THREE.Vector3(5, 4, -5) };
  assert.equal(playerZone(player), 1);
  player.position.y = 0.162;
  assert.equal(playerZone(player), 0);
  player.position.y = 5;
  player.material = 'skin';
  assert.equal(playerZone(player), 2);
});
