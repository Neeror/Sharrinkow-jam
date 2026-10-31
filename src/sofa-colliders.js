import * as THREE from 'three';

export function makeSofaColliders(transform) {
  const parts = [
    ['base', [0, 0.19, 0], [2.38, 0.23, 0.88]],
    ['seat', [0, 0.4, 0.08], [2.12, 0.2, 0.74]],
    ['back', [0, 0.7, -0.35], [2.26, 0.78, 0.21]],
    ['left arm', [-1.22, 0.56, 0], [0.28, 0.6, 0.9]],
    ['right arm', [1.22, 0.56, 0], [0.28, 0.6, 0.9]],
  ];
  for (const x of [-1.09, 1.09]) {
    for (const z of [-0.37, 0.37]) {
      parts.push(['leg', [x, 0.04, z], [0.11, 0.08, 0.13]]);
    }
  }
  return parts.map(([part, position, size]) => {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion(),
      new THREE.Vector3(...size),
    );
    matrix.premultiply(transform);
    return { type: 'box', name: 'sofa', part, material: 'sofa', inverse: matrix.invert() };
  });
}
