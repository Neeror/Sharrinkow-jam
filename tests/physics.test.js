import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CollisionWorld, readBest, saveBest } from '../src/physics.js';
import { Player } from '../src/player.js';
import { VerletRope } from '../src/rope.js';
import { Quality } from '../src/quality.js';
import { HumanThreat } from '../src/threat.js';

function box(position, scale, material = 'wood') {
  const mesh = new THREE.Mesh();
  mesh.position.fromArray(position);
  mesh.scale.fromArray(scale);
  mesh.updateMatrix();
  return { mesh, inverse: mesh.matrix.clone().invert(), type: 'box', material };
}

const controls = () => ({
  yaw: 0,
  horizontal: 0,
  vertical: 0,
  sneak: false,
  sprint: false,
  jumpQueued: false,
});

test('ray tests floors, walls, misses and correct world normals', () => {
  const collision = new CollisionWorld([
    box([0, -0.5, 0], [40, 1, 40]),
    box([0, 4, -5], [10, 8, 0.5]),
  ]);
  const hit = collision.cast(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0), 4);
  assert.equal(hit.distance, 2);
  assert.deepEqual(hit.normal.toArray(), [0, 1, 0]);
  assert.equal(
    collision.cast(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), 10).normal.z,
    1,
  );
  assert.equal(collision.cast(new THREE.Vector3(0, 2, 0), new THREE.Vector3(1, 0, 0), 2), null);
});

test('WASD, sprint, sneak, jump and surface adhesion use fixed physics', () => {
  const world = new CollisionWorld([
    box([0, -0.5, 0], [40, 1, 48], 'floor'),
    box([0, 4, -2], [40, 8, 0.5]),
  ]);
  const player = new Player(world);
  player.reset(new THREE.Vector3(0, 0.16, 0));
  const input = controls();
  input.vertical = 1;
  for (let i = 0; i < 120; i++) player.step(1 / 120, input);
  assert.ok(player.position.z < -1);
  for (let i = 0; i < 240; i++) player.step(1 / 120, input);
  assert.ok(player.normal.z > 0.9);
  assert.ok(player.position.y > 1);
  input.jumpQueued = true;
  player.step(1 / 120, input);
  assert.equal(player.grounded, false);
  assert.ok(player.velocity.z > 1);
  player.reset(new THREE.Vector3(0, 0.16, 10));
  input.sneak = true;
  for (let i = 0; i < 120; i++) player.step(1 / 120, input);
  const quietSpeed = player.speed;
  input.sneak = false;
  input.sprint = true;
  for (let i = 0; i < 120; i++) player.step(1 / 120, input);
  assert.ok(player.speed > quietSpeed * 2);
  assert.ok(player.noise > 0);
});

test('Verlet endpoints stay pinned and wind bends a slack rope', () => {
  const rope = new VerletRope();
  const start = new THREE.Vector3(0, 3, 0);
  const end = new THREE.Vector3(5, 3, 0);
  const wind = new THREE.Vector3(0, 0, 4);
  for (let i = 0; i < 240; i++) rope.update(start, end, 6, 1 / 120, wind);
  assert.equal(rope.positions[0], 0);
  assert.equal(rope.positions.at(-3), 5);
  assert.ok(Array.from(rope.positions).every(Number.isFinite));
  assert.ok(rope.positions[38] > 0.01);
});

test('quality ignores warmup and spikes, queues after 4 seconds, commits only safely', () => {
  const applied = [];
  const quality = new Quality((level) => applied.push(level));
  for (let i = 0; i < 300; i++) quality.sample(1 / 30, true, false);
  assert.equal(quality.pending, false);
  for (let i = 0; i < 600; i++) quality.sample(1 / 60, true, false);
  quality.sample(0.08, true, false);
  for (let i = 0; i < 120; i++) quality.sample(1 / 60, true, false);
  assert.equal(quality.pending, false);
  for (let i = 0; i < 150; i++) quality.sample(1 / 30, true, false);
  assert.equal(quality.pending, true);
  assert.equal(quality.level, 'high');
  quality.sample(1 / 60, false, true);
  assert.equal(quality.level, 'medium');
  quality.select('high');
  for (let i = 0; i < 1000; i++) quality.sample(1 / 30, true, true);
  assert.equal(quality.level, 'high');
  assert.deepEqual(applied, ['medium', 'high']);
});

test('hand warning is exactly one second and targets the last heard position', () => {
  const threat = new HumanThreat(new THREE.Scene(), new THREE.MeshStandardMaterial());
  const player = { position: new THREE.Vector3(5, 4, -2), speed: 0, noise: 0 };
  threat.cooldown = 0;
  threat.warn(player);
  assert.equal(threat.warning, 1);
  for (let i = 0; i < 119; i++) threat.update(1 / 120, player, i / 120, 2);
  assert.equal(threat.reason, '');
  player.position.x += 4;
  for (let i = 0; i < 3; i++) threat.update(1 / 120, player, 1, 2);
  assert.equal(threat.dodges, 1);
  assert.ok(threat.slow > 0);
});

test('new room record rejects invalid values and survives denied storage', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  assert.equal(readBest(storage), null);
  saveBest(storage, 240);
  saveBest(storage, 280);
  assert.equal(readBest(storage), 240);
  saveBest(storage, 210);
  assert.equal(readBest(storage), 210);
  assert.equal(
    readBest({
      getItem() {
        throw Error('denied');
      },
    }),
    null,
  );
});
