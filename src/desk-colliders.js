import * as THREE from 'three';

export function makeDeskColliders(transform, material = 'metal') {
  const parts = [
    ['top', [0, 0.77, 0], [2, 0.034, 0.947]],
    ['left drawers', [-0.737, 0.453, 0], [0.496, 0.606, 0.854]],
    ['right drawers', [0.737, 0.453, 0], [0.496, 0.606, 0.854]],
    ['back', [0, 0.477, -0.438], [0.98, 0.556, 0.026]],
  ];
  for (const x of [-0.73, 0.73]) {
    for (const z of [-0.34, 0.34]) {
      parts.push(['leg', [x, 0.078, z], [0.052, 0.156, 0.052]]);
    }
  }
  return parts.map(([part, position, size]) => {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion(),
      new THREE.Vector3(...size),
    );
    matrix.premultiply(transform);
    return { type: 'box', name: 'desk', part, material, inverse: matrix.invert() };
  });
}
