import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VerletRope } from '../src/rope.js';

test('taut rope loses old slack when endpoints approach and stays thinly curved', () => {
  const rope = new VerletRope();
  const start = new THREE.Vector3(0, 3, 0);
  const end = new THREE.Vector3(5, 3, 0);
  const wind = new THREE.Vector3(0, 0, 4);
  for (let tick = 0; tick < 120; tick++) rope.update(start, end, 7, 1 / 120, wind);
  end.x = 2;
  rope.update(start, end, 2, 1 / 120, wind);
  for (let i = 0; i < rope.count; i++) {
    const t = i / (rope.count - 1);
    const sample = new THREE.Vector3().fromArray(rope.positions, i * 3);
    const line = start.clone().lerp(end, t);
    assert.ok(sample.distanceTo(line) <= 0.02401);
  }
  assert.ok(new THREE.Vector3().fromArray(rope.positions).distanceTo(start) < 0.00001);
  assert.ok(
    new THREE.Vector3().fromArray(rope.positions, (rope.count - 1) * 3).distanceTo(end) < 0.00001,
  );
});
