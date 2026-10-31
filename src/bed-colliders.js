import * as THREE from 'three';

export function makeBedFrameColliders() {
  const parts = [
    ['mattress', [3.71, 1.62, -5.55], [10.05, 0.81, 15.25]],
    ['left rail', [-1.17, 0.82, -5.55], [0.36, 0.72, 15.2]],
    ['right rail', [8.59, 0.82, -5.55], [0.36, 0.72, 15.2]],
    ['headboard', [3.71, 2.64, -13.29], [10.13, 5.1, 0.4]],
    ['footboard', [3.71, 0.65, 1.91], [10.13, 1.12, 0.4]],
  ];
  return parts.map(([part, position, size]) => ({
    type: 'box',
    name: 'bed',
    part,
    material: 'cloth',
    inverse: new THREE.Matrix4()
      .makeScale(...size)
      .setPosition(...position)
      .invert(),
  }));
}
