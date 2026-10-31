import * as THREE from 'three';

export function bakeCollisionGeometry(mesh, transform) {
  const source = mesh.geometry;
  const positions = new THREE.Float32BufferAttribute(
    new Float32Array(source.attributes.position.count * 3),
    3,
  );
  const vertex = new THREE.Vector3();
  mesh.skeleton?.update();
  for (let index = 0; index < positions.count; index++) {
    mesh.getVertexPosition(index, vertex).applyMatrix4(transform);
    positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', positions);
  if (source.index) geometry.setIndex(source.index.clone());
  const result = geometry.index ? geometry.toNonIndexed() : geometry;
  if (result !== geometry) geometry.dispose();
  return result;
}
