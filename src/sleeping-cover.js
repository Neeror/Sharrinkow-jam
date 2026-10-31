import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

export function makeSleepingCover(builder, model) {
  const inverse = builder.scene.matrixWorld.clone().invert();
  const point = new THREE.Vector3();
  const bodyBounds = new THREE.Box3();
  model.traverse((object) => {
    if (!object.isMesh || !object.name.startsWith('Body')) return;
    const p = object.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      object.getVertexPosition(i, point);
      point.applyMatrix4(object.matrixWorld).applyMatrix4(inverse);
      if (point.z > -6) bodyBounds.expandByPoint(point);
    }
  });
  const minX = bodyBounds.min.x - 0.6;
  const maxX = bodyBounds.max.x + 0.6;
  const minZ = -8.6;
  const maxZ = bodyBounds.max.z + 0.5;
  const arm = [];
  model.traverse((object) => {
    if (!object.isBone || !/^DEF-(upper_arm|forearm|hand)R/.test(object.name)) return;
    object.getWorldPosition(point).applyMatrix4(inverse);
    arm.push(point.clone());
  });
  arm.sort((a, b) => a.z - b.z);
  const leftEdge = (z) => {
    if (!arm.length) return minX;
    let x = arm[0].x;
    for (let i = 1; i < arm.length; i++) {
      const a = arm[i - 1];
      const b = arm[i];
      if (z >= a.z) {
        const t = THREE.MathUtils.clamp((z - a.z) / (b.z - a.z || 1), 0, 1);
        x = THREE.MathUtils.lerp(a.x, b.x, t);
      }
    }
    return Math.max(minX, x + 0.55);
  };
  const columns = 28;
  const rows = 48;
  const heights = new Float32Array((columns + 1) * (rows + 1)).fill(3.9);
  model.traverse((object) => {
    if (!object.isMesh) return;
    const p = object.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      object.getVertexPosition(i, point);
      point.applyMatrix4(object.matrixWorld).applyMatrix4(inverse);
      if (point.z < minZ || point.z > maxZ) continue;
      const cx = Math.round(((point.x - minX) / (maxX - minX)) * columns);
      const rz = Math.round(((point.z - minZ) / (maxZ - minZ)) * rows);
      for (let dz = -3; dz <= 3; dz++) {
        for (let dx = -3; dx <= 3; dx++) {
          const x = cx + dx;
          const z = rz + dz;
          if (x < 0 || x > columns || z < 0 || z > rows) continue;
          const height = point.y + 0.18 - (dx * dx + dz * dz) * 0.025;
          const index = z * (columns + 1) + x;
          heights[index] = Math.max(heights[index], height);
        }
      }
    }
  });
  const geometry = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, columns, rows);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const column = Math.round(((x - minX) / (maxX - minX)) * columns);
    const row = Math.round(((z - minZ) / (maxZ - minZ)) * rows);
    const edge = Math.min(column, columns - column);
    const edgeX = leftEdge(z);
    const mappedX = THREE.MathUtils.lerp(edgeX, maxX, column / columns);
    const heightColumn = Math.round(((mappedX - minX) / (maxX - minX)) * columns);
    p.setX(i, mappedX);
    p.setY(
      i,
      heights[row * (columns + 1) + heightColumn] -
        Math.max(0, 2 - edge) * 0.18 +
        Math.sin(z * 8 + x) * 0.025,
    );
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.boundsTree = new MeshBVH(geometry);
  builder.solids.push({
    type: 'mesh',
    geometry,
    inverse: new THREE.Matrix4(),
    material: 'cloth',
    name: 'cover',
  });
  const cloth = builder.materials.sheet.clone();
  cloth.color.set(0xb8c5ce);
  cloth.side = THREE.DoubleSide;
  return builder.add(geometry, cloth, [0, 0, 0], [1, 1, 1]);
}
