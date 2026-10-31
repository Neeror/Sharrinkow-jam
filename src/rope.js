import * as THREE from 'three';
import { PLAYER_RADIUS } from './physics.js';
import { updateAnchorVisuals } from './route.js';

export class VerletRope {
  constructor(count = 24) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.previous = new Float32Array(count * 3);
    this.ready = false;
  }

  update(start, end, length, dt, wind) {
    const p = this.positions;
    const old = this.previous;
    const last = (this.count - 1) * 3;
    if (!this.ready) {
      for (let i = 0; i < this.count; i++) {
        const t = i / (this.count - 1);
        p[i * 3] = start.x + (end.x - start.x) * t;
        p[i * 3 + 1] = start.y + (end.y - start.y) * t;
        p[i * 3 + 2] = start.z + (end.z - start.z) * t;
      }
      old.set(p);
      this.ready = true;
    }
    for (let i = 3; i < last; i++) {
      const value = p[i];
      p[i] += (p[i] - old[i]) * 0.985;
      old[i] = value;
      p[i] += (i % 3 === 1 ? -3 : i % 3 === 0 ? wind.x : wind.z) * dt * dt;
    }
    const segment = Math.max(length, start.distanceTo(end)) / (this.count - 1);
    for (let iteration = 0; iteration < 8; iteration++) {
      p[0] = start.x;
      p[1] = start.y;
      p[2] = start.z;
      p[last] = end.x;
      p[last + 1] = end.y;
      p[last + 2] = end.z;
      for (let i = 0; i < last; i += 3) {
        const dx = p[i + 3] - p[i];
        const dy = p[i + 4] - p[i + 1];
        const dz = p[i + 5] - p[i + 2];
        const distance = Math.hypot(dx, dy, dz) || 1;
        const correction = ((distance - segment) / distance) * 0.5;
        if (i > 0) {
          p[i] += dx * correction;
          p[i + 1] += dy * correction;
          p[i + 2] += dz * correction;
        }
        if (i + 3 < last) {
          p[i + 3] -= dx * correction;
          p[i + 4] -= dy * correction;
          p[i + 5] -= dz * correction;
        }
      }
    }
    const span = start.distanceTo(end);
    if (length > span * 1.02) return;
    for (let i = 0; i < this.count; i++) {
      const t = i / (this.count - 1);
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      const z = start.z + (end.z - start.z) * t;
      const dx = p[i * 3] - x;
      const dy = p[i * 3 + 1] - y;
      const dz = p[i * 3 + 2] - z;
      const maximum = Math.min(0.045, span * 0.012) * Math.sin(Math.PI * t);
      const factor = Math.min(1, maximum / (Math.hypot(dx, dy, dz) || 1));
      p[i * 3] = x + dx * factor;
      p[i * 3 + 1] = y + dy * factor;
      p[i * 3 + 2] = z + dz * factor;
    }
  }
}

export class Thread {
  constructor(scene, anchors, collision) {
    this.anchors = anchors;
    this.collision = collision;
    this.anchor = null;
    this.candidate = null;
    this.held = false;
    this.length = 0;
    this.rope = new VerletRope();
    this.direction = new THREE.Vector3();
    this.projected = new THREE.Vector3();
    this.wind = new THREE.Vector3();
    this.start = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.tangent = new THREE.Vector3();
    this.side = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.sample = new THREE.Vector3();
    this.lastStart = new THREE.Vector3();
    this.descentAnchor = { position: new THREE.Vector3() };
    this.geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(this.rope.count * 5 * 3);
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(vertices, 3).setUsage(THREE.DynamicDrawUsage),
    );
    const indices = [];
    for (let i = 0; i < this.rope.count - 1; i++) {
      for (let j = 0; j < 5; j++) {
        const a = i * 5 + j;
        const b = i * 5 + ((j + 1) % 5);
        indices.push(a, a + 5, b, b, a + 5, b + 5);
      }
    }
    this.geometry.setIndex(indices);
    this.mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshBasicMaterial({ color: 0xd5fff0, transparent: true, opacity: 0.9 }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  aim(camera, player, time) {
    this.candidate = null;
    let closest = 0.18;
    for (let i = 0; i < this.anchors.length; i++) {
      const anchor = this.anchors[i];
      anchor.position.y = anchor.base + (anchor.human ? Math.sin(time * 1.3) * 0.055 : 0);
      updateAnchorVisuals(anchor);
      anchor.ring.quaternion.copy(camera.quaternion);
      const distance = player.position.distanceTo(anchor.position);
      anchor.marker.visible = distance < 12;
      if (distance > 8 || distance < 0.3) continue;
      this.projected.copy(anchor.marker.position).project(camera);
      const offset = Math.hypot(this.projected.x * camera.aspect, this.projected.y);
      if (this.projected.z > 1 || this.projected.z < -1 || offset >= closest) continue;
      this.direction.subVectors(anchor.position, player.position).normalize();
      if (anchor.position.y < 0) continue;
      const surface = this.collision.cast(player.position, this.direction, distance + 0.08);
      if (!surface || surface.point.distanceTo(anchor.position) > 0.12) continue;
      closest = offset;
      this.candidate = anchor;
    }
  }

  release() {
    this.anchor = null;
    this.mesh.visible = false;
  }

  step(dt, player, input, wind) {
    this.lastStart.copy(player.position);
    if (input.thread && !this.held && this.candidate) {
      this.anchor = this.candidate;
      this.length = player.position.distanceTo(this.anchor.position);
      this.rope.ready = false;
      player.velocity.addScaledVector(player.normal, 1.1);
      player.jumpCooldown = 0.15;
      player.grounded = false;
      player.noise += 0.035;
    }
    if (player.rappelling) {
      this.descentAnchor.position.copy(player.rappelPoint);
      this.anchor = this.descentAnchor;
      this.length = player.position.distanceTo(player.rappelPoint);
      this.rope.update(
        player.position,
        player.rappelPoint,
        this.length,
        dt,
        this.wind.set(0, 0, 0),
      );
      return;
    }
    if (!input.thread) this.release();
    this.held = input.thread;
    if (!this.anchor) return;
    if (this.anchor === this.descentAnchor) {
      this.release();
      return;
    }
    this.direction.subVectors(this.anchor.position, player.position);
    const span = this.direction.length();
    this.direction.divideScalar(span || 1);
    const visible = this.collision.cast(player.position, this.direction, span + 0.1);
    if (
      this.anchor.position.y < 0 ||
      !visible ||
      visible.point.distanceTo(this.anchor.position) > 0.15
    ) {
      this.release();
      return;
    }
    if (input.reel) this.length = Math.max(0.45, this.length - dt * 1.7);
    this.direction.subVectors(player.position, this.anchor.position);
    const distance = this.direction.length();
    this.direction.divideScalar(distance || 1);
    if (distance > this.length) {
      const correction = Math.min(distance - this.length, 0.16);
      const block = this.collision.cast(
        player.position,
        this.projected.copy(this.direction).negate(),
        correction + 0.16,
      );
      if (block) {
        this.release();
        return;
      }
      this.projected.copy(this.direction).multiplyScalar(-correction);
      if (this.collision.moveSphere(player.position, this.projected, PLAYER_RADIUS)) {
        this.release();
        return;
      }
      if (player.position.y < PLAYER_RADIUS) {
        player.position.y = PLAYER_RADIUS + 0.002;
        player.resolvePenetration();
        this.release();
        return;
      }
      const radial = player.velocity.dot(this.direction);
      if (radial > 0) player.velocity.addScaledVector(this.direction, -radial);
      if (input.reel) player.velocity.addScaledVector(this.direction, -dt * 1.8);
    }
    this.wind.copy(wind || this.wind.set(0, 0, 0));
    this.rope.update(player.position, this.anchor.position, distance, dt, this.wind);
  }

  render(player) {
    this.mesh.visible = Boolean(this.anchor);
    if (!this.anchor) return;
    this.start.copy(player?.renderPosition || this.lastStart);
    if (player) {
      this.offset.set(-0.13, 0.035, 0).applyQuaternion(player.orientation);
      this.start.add(this.offset);
    }
    const p = this.rope.positions;
    this.offset.set(this.start.x - p[0], this.start.y - p[1], this.start.z - p[2]);
    this.tangent.subVectors(this.anchor.position, this.start).normalize();
    this.up.set(0, 1, 0);
    if (Math.abs(this.tangent.y) > 0.95) this.up.set(1, 0, 0);
    this.side.crossVectors(this.tangent, this.up).normalize();
    this.up.crossVectors(this.side, this.tangent).normalize();
    const target = this.geometry.attributes.position;
    for (let i = 0; i < this.rope.count; i++) {
      const t = i / (this.rope.count - 1);
      this.sample.fromArray(p, i * 3).addScaledVector(this.offset, 1 - t);
      this.sample.y = Math.max(0.004, this.sample.y);
      for (let j = 0; j < 5; j++) {
        const angle = (j / 5) * Math.PI * 2;
        const x = Math.cos(angle) * 0.003;
        const y = Math.sin(angle) * 0.003;
        target.setXYZ(
          i * 5 + j,
          this.sample.x + this.side.x * x + this.up.x * y,
          this.sample.y + this.side.y * x + this.up.y * y,
          this.sample.z + this.side.z * x + this.up.z * y,
        );
      }
    }
    target.needsUpdate = true;
  }
}
