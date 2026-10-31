import test from 'node:test';
import assert from 'node:assert/strict';
import { smooth, ENDING_DURATION } from '../src/ending.js';

test('cinematic curves use elapsed seconds at every frame rate', () => {
  assert.equal(smooth(1, 2, 0), 0);
  assert.equal(smooth(1, 2, 3), 1);
  assert.equal(smooth(1, 2, 1.5), 0.5);
  for (const fps of [30, 60, 120]) {
    let time = 0;
    for (let i = 0; i < fps * ENDING_DURATION; i++) time += 1 / fps;
    assert.ok(Math.abs(time - ENDING_DURATION) < 1e-9);
    assert.equal(smooth(6.5, 8.5, time), 1);
  }
});
