import * as THREE from 'three';

export const FIXED_STEP = 1 / 120;
export const PLAYER_RADIUS = 0.16;
export const GRAVITY = 9.8;

export class CollisionWorld {
  constructor(solids) {
    this.solids = solids;
    this.origin = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.point = new THREE.Vector3();
    this.normal = new THREE.Vector3();
    this.ray = new THREE.Ray();
    this.matrix = new THREE.Matrix4();
    this.triangle = new THREE.Triangle();
    this.faceNormal = new THREE.Vector3();
    this.closest = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
    this.motion = new THREE.Vector3();
    this.expected = new THREE.Vector3();
    this.localPosition = new THREE.Vector3();
    this.normalMatrix = new THREE.Matrix3();
    this.recoveryOrigin = new THREE.Vector3();
    this.recoveryCandidate = new THREE.Vector3();
    this.recoveryBest = new THREE.Vector3();
    this.result = {
      distance: Infinity,
      point: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      solid: null,
    };
  }

  moveSphere(position, displacement, radius, normalTarget = null) {
    const steps = Math.max(1, Math.ceil(displacement.length() / (radius * 0.45)));
    this.motion.copy(displacement).divideScalar(steps);
    let blocked = false;
    for (let i = 0; i < steps; i++) {
      position.add(this.motion);
      this.expected.copy(position);
      if (this.resolveSphere(position, radius, normalTarget)) {
        if (position.distanceToSquared(this.expected) > 0.000001) blocked = true;
      }
    }
    return blocked;
  }

  resolveSphere(position, radius, normalTarget = null) {
    let resolved = false;
    for (let iteration = 0; iteration < 3; iteration++) {
      let moved = false;
      for (let i = 0; i < this.solids.length; i++) {
        const solid = this.solids[i];
        let contact = false;
        if (solid.type === 'box') contact = this.resolveBox(solid, position, radius);
        else if (solid.type === 'mesh') {
          this.localPosition.copy(position).applyMatrix4(solid.inverse);
          contact = this.resolveShell(solid, this.localPosition, radius);
          if (contact) {
            this.matrix.copy(solid.inverse).invert();
            position.copy(this.localPosition).applyMatrix4(this.matrix);
            this.normalMatrix.getNormalMatrix(this.matrix);
            this.normal.applyMatrix3(this.normalMatrix).normalize();
          }
        }
        if (contact && normalTarget) normalTarget.copy(this.normal);
        moved ||= contact;
      }
      resolved ||= moved;
      if (!moved) break;
    }
    for (const solid of this.solids) {
      if (solid.type !== 'box' || solid.material !== 'floor') continue;
      if (this.resolveBox(solid, position, radius)) {
        resolved = true;
        if (normalTarget) normalTarget.copy(this.normal);
      }
    }
    if (this.isInsideSolid(position)) {
      this.recoverExterior(position, radius, normalTarget);
      resolved = true;
    }
    return resolved;
  }

  isInsideSolid(position) {
    for (const solid of this.solids) {
      this.localPosition.copy(position).applyMatrix4(solid.inverse);
      if (solid.type === 'box') {
        if (
          Math.max(
            Math.abs(this.localPosition.x),
            Math.abs(this.localPosition.y),
            Math.abs(this.localPosition.z),
          ) < 0.499999
        )
          return true;
      } else if (solid.type === 'mesh' && solid.closed) {
        if (
          solid.geometry.boundingBox.containsPoint(this.localPosition) &&
          this.containsPoint(solid, this.localPosition)
        )
          return true;
      }
    }
    return false;
  }

  hasSphereClearance(position, radius) {
    for (const solid of this.solids) {
      if (solid.type !== 'box' || solid.material !== 'floor') continue;
      this.matrix.copy(solid.inverse).invert();
      this.point.set(0, 0.5, 0).applyMatrix4(this.matrix);
      if (position.y < this.point.y + radius) return false;
    }
    if (this.isInsideSolid(position)) return false;
    for (const solid of this.solids) {
      this.localPosition.copy(position).applyMatrix4(solid.inverse);
      if (solid.type === 'box') {
        this.point.copy(this.localPosition).clampScalar(-0.5, 0.5);
        this.matrix.copy(solid.inverse).invert();
        this.point.applyMatrix4(this.matrix);
        if (this.point.distanceToSquared(position) < radius * radius) return false;
      } else if (solid.type === 'mesh') {
        const closest = solid.geometry.boundsTree.closestPointToPoint(
          this.localPosition,
          this.closest,
        );
        if (!closest) continue;
        this.matrix.copy(solid.inverse).invert();
        this.point.copy(closest.point).applyMatrix4(this.matrix);
        if (this.point.distanceToSquared(position) < radius * radius) return false;
      }
    }
    return true;
  }

  recoverExterior(position, radius, normalTarget) {
    this.recoveryOrigin.copy(position);
    let best = Infinity;
    for (let axis = 0; axis < 3; axis++) {
      for (const sign of [-1, 1]) {
        for (let distance = radius; distance < 8; distance += radius) {
          this.recoveryCandidate.copy(this.recoveryOrigin);
          this.recoveryCandidate.setComponent(
            axis,
            this.recoveryCandidate.getComponent(axis) + sign * distance,
          );
          if (!this.hasSphereClearance(this.recoveryCandidate, radius)) continue;
          if (distance < best) {
            best = distance;
            this.recoveryBest.copy(this.recoveryCandidate);
          }
          break;
        }
      }
    }
    if (best < Infinity) {
      position.copy(this.recoveryBest);
      if (normalTarget) normalTarget.subVectors(position, this.recoveryOrigin).normalize();
    }
  }

  resolveBox(solid, position, radius) {
    this.origin.copy(position).applyMatrix4(solid.inverse);
    const matrix = this.matrix.copy(solid.inverse).invert();
    const m = matrix.elements;
    this.point.set(
      THREE.MathUtils.clamp(this.origin.x, -0.5, 0.5),
      THREE.MathUtils.clamp(this.origin.y, -0.5, 0.5),
      THREE.MathUtils.clamp(this.origin.z, -0.5, 0.5),
    );
    const inside = this.point.equals(this.origin);
    if (inside) {
      let axis = 0;
      let best = Infinity;
      for (let k = 0; k < 3; k++) {
        const axisScale = Math.hypot(m[k * 4], m[k * 4 + 1], m[k * 4 + 2]);
        const depth = (0.5 - Math.abs(this.origin.getComponent(k))) * axisScale;
        if (depth < best) {
          best = depth;
          axis = k;
        }
      }
      this.point.setComponent(axis, Math.sign(this.origin.getComponent(axis)) * 0.5 || 0.5);
    }
    this.point.applyMatrix4(matrix);
    this.normal.subVectors(position, this.point);
    const distance = this.normal.length();
    if (!inside && distance >= radius) return false;
    if (inside) {
      this.normal.subVectors(this.point, position);
      if (distance < 0.000001) {
        this.normal.set(0, 0, 0);
        for (let k = 0; k < 3; k++) {
          if (Math.abs(Math.abs(this.origin.getComponent(k)) - 0.5) < 0.000001) {
            this.normal.setComponent(k, Math.sign(this.origin.getComponent(k)));
            break;
          }
        }
        this.normal.transformDirection(matrix);
      }
    }
    this.normal.normalize();
    position.copy(this.point).addScaledVector(this.normal, radius + 0.002);
    return true;
  }

  resolveShell(solid, position, radius) {
    const tree = solid.geometry.boundsTree;
    const box = solid.geometry.boundingBox;
    if (
      position.x < box.min.x - radius ||
      position.y < box.min.y - radius ||
      position.z < box.min.z - radius ||
      position.x > box.max.x + radius ||
      position.y > box.max.y + radius ||
      position.z > box.max.z + radius
    )
      return false;
    const closest = tree.closestPointToPoint(position, this.closest);
    if (!closest) return false;
    const attribute = solid.geometry.attributes.position;
    const face = closest.faceIndex * 3;
    const index = solid.geometry.index;
    this.triangle.a.fromBufferAttribute(attribute, index ? index.getX(face) : face);
    this.triangle.b.fromBufferAttribute(attribute, index ? index.getX(face + 1) : face + 1);
    this.triangle.c.fromBufferAttribute(attribute, index ? index.getX(face + 2) : face + 2);
    this.triangle.getNormal(this.faceNormal);
    this.normal.subVectors(position, closest.point);
    const signedDistance = this.normal.dot(this.faceNormal);
    if (solid.oneSided && signedDistance < 0) return false;
    const inside = solid.closed && this.containsPoint(solid, position);
    if (!inside && closest.distance >= radius) return false;
    if (inside || closest.distance < 0.000001) this.normal.copy(this.faceNormal);
    else this.normal.normalize();
    position.copy(closest.point).addScaledVector(this.normal, radius + 0.002);
    return true;
  }

  containsPoint(solid, position) {
    this.ray.origin.copy(position);
    this.ray.direction.set(0.823, 0.371, 0.429).normalize();
    let crossings = 0;
    for (let i = 0; i < 128; i++) {
      const hit = solid.geometry.boundsTree.raycastFirst(this.ray, THREE.DoubleSide);
      if (!hit) return crossings % 2 === 1;
      crossings++;
      this.ray.origin.addScaledVector(this.ray.direction, hit.distance + 0.00001);
    }
    return false;
  }

  cast(origin, direction, maximum) {
    const hit = this.result;
    hit.distance = maximum;
    hit.solid = null;
    for (let i = 0; i < this.solids.length; i++) {
      const solid = this.solids[i];
      const e = solid.inverse.elements;
      this.origin.copy(origin).applyMatrix4(solid.inverse);
      this.direction.set(
        e[0] * direction.x + e[4] * direction.y + e[8] * direction.z,
        e[1] * direction.x + e[5] * direction.y + e[9] * direction.z,
        e[2] * direction.x + e[6] * direction.y + e[10] * direction.z,
      );
      let distance = Infinity;
      if (solid.type === 'mesh') {
        this.ray.set(this.origin, this.direction);
        const intersection = solid.geometry.boundsTree.raycastFirst(
          this.ray,
          solid.oneSided ? THREE.FrontSide : THREE.DoubleSide,
          0,
          hit.distance,
        );
        if (!intersection) continue;
        distance = intersection.distance;
        this.normal.copy(intersection.face.normal);
        if (this.normal.dot(this.direction) > 0) this.normal.negate();
      } else if (solid.type === 'heightfield') {
        this.point.copy(this.direction).multiplyScalar(maximum).add(this.origin);
        if (
          Math.max(this.origin.x, this.point.x) < solid.minX ||
          Math.min(this.origin.x, this.point.x) > solid.maxX ||
          Math.max(this.origin.z, this.point.z) < solid.minZ ||
          Math.min(this.origin.z, this.point.z) > solid.maxZ ||
          Math.min(this.origin.y, this.point.y) > 5.8 ||
          Math.max(this.origin.y, this.point.y) < 1.3
        )
          continue;
        let previousDistance = 0;
        let previousHeight = this.origin.y - solid.height(this.origin.x, this.origin.z);
        const step = Math.min(0.12, maximum / 4);
        for (let t = step; t <= maximum + step; t += step) {
          const sample = Math.min(t, maximum);
          this.point.copy(this.direction).multiplyScalar(sample).add(this.origin);
          if (
            this.point.x < solid.minX ||
            this.point.x > solid.maxX ||
            this.point.z < solid.minZ ||
            this.point.z > solid.maxZ
          ) {
            previousDistance = sample;
            previousHeight = this.point.y - solid.height(this.point.x, this.point.z);
            continue;
          }
          const height = this.point.y - solid.height(this.point.x, this.point.z);
          if (previousHeight >= 0 && height <= 0) {
            let left = previousDistance;
            let right = sample;
            for (let iteration = 0; iteration < 8; iteration++) {
              const middle = (left + right) * 0.5;
              this.point.copy(this.direction).multiplyScalar(middle).add(this.origin);
              if (this.point.y > solid.height(this.point.x, this.point.z)) left = middle;
              else right = middle;
            }
            distance = (left + right) * 0.5;
            this.point.copy(this.direction).multiplyScalar(distance).add(this.origin);
            const x = this.point.x;
            const z = this.point.z;
            this.normal
              .set(
                (solid.height(x - 0.01, z) - solid.height(x + 0.01, z)) / 0.02,
                1,
                (solid.height(x, z - 0.01) - solid.height(x, z + 0.01)) / 0.02,
              )
              .normalize();
            break;
          }
          previousDistance = sample;
          previousHeight = height;
        }
      } else if (solid.type === 'sphere') {
        const a = this.direction.lengthSq();
        const b = this.origin.dot(this.direction);
        const c = this.origin.lengthSq() - 1;
        const discriminant = b * b - a * c;
        if (discriminant < 0) continue;
        distance = (-b - Math.sqrt(discriminant)) / a;
        if (distance < 0) continue;
        this.normal.copy(this.direction).multiplyScalar(distance).add(this.origin).normalize();
      } else {
        let near = -Infinity;
        let far = Infinity;
        let axis = 0;
        let sign = 1;
        for (let k = 0; k < 3; k++) {
          const o = this.origin.getComponent(k);
          const d = this.direction.getComponent(k);
          if (Math.abs(d) < 0.000001) {
            if (Math.abs(o) > 0.5) far = -Infinity;
            continue;
          }
          let a = (-0.5 - o) / d;
          let b = (0.5 - o) / d;
          if (a > b) {
            const swap = a;
            a = b;
            b = swap;
          }
          if (a > near) {
            near = a;
            axis = k;
            sign = d > 0 ? -1 : 1;
          }
          far = Math.min(far, b);
        }
        if (near > far || near < 0) continue;
        distance = near;
        this.normal.set(0, 0, 0).setComponent(axis, sign);
      }
      if (distance >= hit.distance || distance < 0.00001) continue;
      hit.distance = distance;
      hit.solid = solid;
      hit.point.copy(direction).multiplyScalar(distance).add(origin);
      const n = this.normal;
      hit.normal
        .set(
          e[0] * n.x + e[1] * n.y + e[2] * n.z,
          e[4] * n.x + e[5] * n.y + e[6] * n.z,
          e[8] * n.x + e[9] * n.y + e[10] * n.z,
        )
        .normalize();
    }
    return hit.solid ? hit : null;
  }
}

export function readBest(storage) {
  try {
    const value = Number(storage.getItem('ruka-cela-room-best'));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function saveBest(storage, time) {
  const best = Math.min(readBest(storage) ?? Infinity, time);
  try {
    storage.setItem('ruka-cela-room-best', String(best));
  } catch {}
  return best;
}
