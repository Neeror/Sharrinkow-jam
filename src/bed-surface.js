import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

export function bedWalkableSurface(shell) {
  const source = shell.index ? shell.toNonIndexed() : shell;
  const p = source.attributes.position;
  const vertices = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const triangle = new THREE.Triangle(a, b, c);
  const normal = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    triangle.getNormal(normal);
    if (normal.y < -0.001 || Math.max(a.y, b.y, c.y) < 2.12) continue;
    vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  if (source !== shell) source.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeBoundingBox();
  geometry.boundsTree = new MeshBVH(geometry);
  return geometry;
}
