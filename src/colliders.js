import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

const MINIMUM_GAP = 0.4;
const MINIMUM_THICKNESS = 0.08;

function sampleColumns(bounds, tree, step) {
  const columns = Math.max(2, Math.ceil((bounds.max.x - bounds.min.x) / step) + 1);
  const rows = Math.max(2, Math.ceil((bounds.max.z - bounds.min.z) / step) + 1);
  const top = new Float32Array(columns * rows).fill(NaN);
  const bottom = new Float32Array(columns * rows).fill(NaN);
  const ray = new THREE.Ray();
  const down = new THREE.Vector3(0, -1, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const span = bounds.max.y - bounds.min.y + 0.4;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = Math.min(bounds.min.x + column * step, bounds.max.x);
      const z = Math.min(bounds.min.z + row * step, bounds.max.z);
      ray.origin.set(x, bounds.max.y + 0.2, z);
      ray.direction.copy(down);
      const upper = tree.raycastFirst(ray, THREE.DoubleSide, 0, span);
      if (!upper) continue;
      ray.origin.set(x, bounds.min.y - 0.2, z);
      ray.direction.copy(up);
      const lower = tree.raycastFirst(ray, THREE.DoubleSide, 0, span);
      const index = row * columns + column;
      let floor = lower ? lower.point.y : bounds.min.y;
      if (floor - bounds.min.y < MINIMUM_GAP) floor = bounds.min.y;
      top[index] = Math.max(upper.point.y, floor + MINIMUM_THICKNESS);
      bottom[index] = floor;
    }
  }
  return { columns, rows, top, bottom };
}

class ShellWriter {
  constructor(bounds, step, grid) {
    this.bounds = bounds;
    this.step = step;
    this.grid = grid;
    this.positions = [];
    this.a = new THREE.Vector3();
    this.b = new THREE.Vector3();
    this.c = new THREE.Vector3();
    this.normal = new THREE.Vector3();
  }

  point(target, column, row, field) {
    const { columns, top, bottom } = this.grid;
    const index = row * columns + column;
    return target.set(
      Math.min(this.bounds.min.x + column * this.step, this.bounds.max.x),
      field === 'top' ? top[index] : bottom[index],
      Math.min(this.bounds.min.z + row * this.step, this.bounds.max.z),
    );
  }

  triangle(a, b, c, outward) {
    this.normal.subVectors(b, a).cross(this.c.subVectors(c, a));
    if (this.normal.lengthSq() < 1e-10) return;
    if (this.normal.dot(outward) < 0) {
      this.positions.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    } else {
      this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
  }

  quad(field, corners, outward) {
    const [p0, p1, p2, p3] = corners.map(([column, row], index) =>
      this.point(new THREE.Vector3(), column, row, Array.isArray(field) ? field[index] : field),
    );
    this.triangle(p0, p1, p2, outward);
    this.triangle(p0, p2, p3, outward);
  }
}

function cellFilled(grid, column, row) {
  if (column < 0 || row < 0 || column >= grid.columns - 1 || row >= grid.rows - 1) return false;
  const { columns, top } = grid;
  return (
    !Number.isNaN(top[row * columns + column]) &&
    !Number.isNaN(top[row * columns + column + 1]) &&
    !Number.isNaN(top[(row + 1) * columns + column]) &&
    !Number.isNaN(top[(row + 1) * columns + column + 1])
  );
}

function writeCell(writer, grid, column, row, floorLevel) {
  const corners = [
    [column, row],
    [column + 1, row],
    [column + 1, row + 1],
    [column, row + 1],
  ];
  writer.quad('top', corners, new THREE.Vector3(0, 1, 0));
  writer.quad('bottom', corners, new THREE.Vector3(0, -1, 0));
  const sides = [
    [0, -1, corners[0], corners[1]],
    [1, 0, corners[1], corners[2]],
    [0, 1, corners[2], corners[3]],
    [-1, 0, corners[3], corners[0]],
  ];
  for (const [dx, dz, a, b] of sides) {
    if (cellFilled(grid, column + dx, row + dz)) continue;
    writer.quad(['bottom', 'bottom', 'top', 'top'], [a, b, b, a], new THREE.Vector3(dx, 0, dz));
  }
}

export function buildShellCollider(detailed, step = 0.25) {
  detailed.computeBoundingBox();
  const bounds = detailed.boundingBox.clone();
  const tree = detailed.boundsTree || new MeshBVH(detailed);
  const grid = sampleColumns(bounds, tree, step);
  const writer = new ShellWriter(bounds, step, grid);
  for (let row = 0; row < grid.rows - 1; row++) {
    for (let column = 0; column < grid.columns - 1; column++) {
      if (cellFilled(grid, column, row)) writeCell(writer, grid, column, row, bounds.min.y);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(writer.positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.boundsTree = new MeshBVH(geometry, { maxLeafTris: 8 });
  return geometry;
}
