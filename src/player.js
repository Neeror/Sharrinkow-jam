import * as THREE from 'three';
import { PLAYER_RADIUS, GRAVITY } from './physics.js';
import { SOFT_MATERIALS } from './surfaces.js';

export class Player {
  constructor(collision) {
    this.collision = collision;
    this.position = new THREE.Vector3(-7, PLAYER_RADIUS, 21);
    this.previous = this.position.clone();
    this.renderPosition = this.position.clone();
    this.velocity = new THREE.Vector3();
    this.normal = new THREE.Vector3(0, 1, 0);
    this.renderNormal = this.normal.clone();
    this.safePosition = this.position.clone();
    this.rappelling = false;
    this.rappelPoint = this.position.clone();
    this.motion = new THREE.Vector3();
    this.facing = new THREE.Vector3(0, 0, -1);
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.probe = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.travel = new THREE.Vector3();
    this.previousNormal = new THREE.Vector3();
    this.rotation = new THREE.Quaternion();
    this.matrix = new THREE.Matrix4();
    this.orientation = new THREE.Quaternion();
    this.axis = new THREE.Vector3();
    this.grounded = true;
    this.material = 'floor';
    this.jumpCooldown = 0;
    this.noise = 0;
    this.distance = 0;
    this.speed = 0;
    this.slow = 0;
  }

  reset(position) {
    this.position.copy(position);
    this.collision.resolveSphere(this.position, PLAYER_RADIUS);
    this.previous.copy(this.position);
    this.renderPosition.copy(this.position);
    this.safePosition.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.normal.set(0, 1, 0);
    this.renderNormal.copy(this.normal);
    this.rappelling = false;
    this.facing.set(0, 0, -1);
    this.grounded = true;
    this.jumpCooldown = 0;
    this.slow = 0;
    this.noise = 0;
    this.speed = 0;
    this.surfaceType = 'box';
  }

  contact(hit, preserveTangent = false) {
    const incoming = Math.max(0, -this.velocity.dot(hit.normal));
    if (!this.grounded && incoming > 2.5) this.noise += (incoming - 2.5) * 0.07;
    this.previousNormal.copy(this.normal);
    this.rotation.setFromUnitVectors(this.normal, hit.normal);
    this.facing.applyQuaternion(this.rotation);
    this.normal.copy(hit.normal);
    if (
      preserveTangent &&
      this.previousNormal.y > 0.5 &&
      hit.normal.dot(this.previousNormal) > 0.95
    ) {
      const separation = this.travel.subVectors(this.position, hit.point).dot(hit.normal);
      this.position.addScaledVector(hit.normal, PLAYER_RADIUS - separation);
    } else this.position.copy(hit.point).addScaledVector(hit.normal, PLAYER_RADIUS);
    this.velocity.addScaledVector(this.normal, -this.velocity.dot(this.normal));
    this.grounded = true;
    this.material = hit.solid.material;
    this.surfaceType = hit.solid.type;
  }

  step(dt, input, wind, attached = false) {
    this.previous.copy(this.position);
    this.noise = 0;
    if (input.descend && this.grounded && this.normal.y < 0.5 && this.position.y > 0.8) {
      this.probe.copy(this.position).addScaledVector(this.normal, 0.12);
      this.direction.set(0, -1, 0);
      const landing = this.collision.cast(this.probe, this.direction, this.position.y + 1);
      const clearDescent = !landing || (landing.normal.y > 0.5 && landing.point.y < 0.1);
      if (clearDescent) {
        this.rappelPoint.copy(this.position).addScaledVector(this.normal, -PLAYER_RADIUS);
        this.motion.copy(this.normal).multiplyScalar(0.12);
        this.collision.moveSphere(this.position, this.motion, PLAYER_RADIUS);
        this.rappelling = true;
      }
    }
    if (
      (input.descend || (input.sneak && this.material !== 'skin')) &&
      this.grounded &&
      this.normal.y > 0.5 &&
      this.position.y > 0.8 &&
      this.jumpCooldown <= 0
    ) {
      this.travel.set(
        Math.sin(input.yaw) * input.vertical + Math.cos(input.yaw) * input.horizontal,
        0,
        -Math.cos(input.yaw) * input.vertical + Math.sin(input.yaw) * input.horizontal,
      );
      if (this.travel.lengthSq() < 0.01) this.travel.copy(this.facing);
      this.travel.normalize();
      this.probe.copy(this.position).addScaledVector(this.travel, PLAYER_RADIUS + 0.25);
      this.direction.set(0, -1, 0);
      const ledge = this.collision.cast(this.probe, this.direction, PLAYER_RADIUS + 0.45);
      const barrier = this.collision.cast(this.position, this.travel, PLAYER_RADIUS + 0.3);
      if (!ledge && !barrier) {
        this.rappelPoint.copy(this.position).addScaledVector(this.normal, -PLAYER_RADIUS);
        this.motion.subVectors(this.probe, this.position);
        this.collision.moveSphere(this.position, this.motion, PLAYER_RADIUS);
        this.rappelling = true;
        this.position.addScaledVector(this.normal, 0.05);
      }
    }
    if (this.rappelling) {
      this.grounded = false;
      this.normal.set(0, 1, 0);
      this.velocity.set(
        Math.sin(input.yaw) * input.vertical * 0.5,
        -0.65,
        -Math.cos(input.yaw) * input.vertical * 0.5,
      );
      this.motion.copy(this.velocity).multiplyScalar(dt);
      this.direction.copy(this.motion).normalize();
      const landing = this.collision.cast(
        this.position,
        this.direction,
        this.motion.length() + PLAYER_RADIUS,
      );
      if (landing && landing.normal.y > 0.5) {
        this.contact(landing);
        this.rappelling = false;
        this.velocity.set(0, 0, 0);
        this.speed = 0;
        return;
      }
      const blocked = this.collision.moveSphere(
        this.position,
        this.motion,
        PLAYER_RADIUS,
        this.direction,
      );
      if (blocked) {
        this.rappelling = false;
        this.grounded = true;
        this.normal.copy(this.direction).normalize();
        this.velocity.set(0, 0, 0);
        this.jumpCooldown = 0.15;
      }
      this.speed = this.velocity.length();
      this.distance += this.position.distanceTo(this.previous);
      this.material = this.grounded ? 'floor' : this.material;
      return;
    }
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    const pitch = input.pitch ?? 0;
    this.forward.set(
      Math.sin(input.yaw) * Math.cos(pitch),
      -Math.sin(pitch),
      -Math.cos(input.yaw) * Math.cos(pitch),
    );
    const incidence = this.forward.dot(this.normal);
    this.right.set(Math.cos(input.yaw), 0, Math.sin(input.yaw));
    this.right.addScaledVector(this.normal, -this.right.dot(this.normal));
    if (this.right.lengthSq() < 0.0001) this.right.crossVectors(this.facing, this.normal);
    this.right.normalize();
    this.forward.addScaledVector(this.normal, -incidence);
    this.travel.crossVectors(this.normal, this.right).normalize();
    if (this.normal.y < -0.01) this.travel.negate();
    if (Math.abs(this.normal.y) < 0.01 && incidence > 0) this.travel.negate();
    const fallback = THREE.MathUtils.smoothstep(Math.abs(incidence), 0.5, 0.85);
    if (this.forward.lengthSq() > 0.0025) this.forward.normalize();
    else this.forward.copy(this.travel);
    this.forward.lerp(this.travel, fallback).normalize();
    this.right.addScaledVector(this.forward, -this.right.dot(this.forward));
    if (this.right.lengthSq() < 0.0025) this.right.crossVectors(this.forward, this.normal);
    this.right.normalize();
    this.desired
      .copy(this.forward)
      .multiplyScalar(input.vertical)
      .addScaledVector(this.right, input.horizontal);
    if (this.desired.lengthSq() > 1) this.desired.normalize();
    const moving = this.desired.lengthSq() > 0.01;
    const speed = (input.sneak ? 0.85 : input.sprint ? 3.1 : 1.75) * (this.slow > 0 ? 0.25 : 1);
    this.slow = Math.max(0, this.slow - dt);
    if (
      this.grounded &&
      this.surfaceType === 'sphere' &&
      incidence > 0.65 &&
      this.normal.y < 0.3 &&
      moving
    ) {
      this.grounded = false;
      this.jumpCooldown = 0.15;
      this.velocity.set(Math.sin(input.yaw) * speed, 0, -Math.cos(input.yaw) * speed);
    }
    if (this.grounded && !attached) {
      this.velocity.lerp(this.desired.multiplyScalar(speed), 1 - Math.exp(-dt * 15));
      if (moving) this.facing.lerp(this.velocity, dt * 10).normalize();
      if (input.jumpQueued) {
        this.velocity.addScaledVector(this.normal, 3.3);
        this.position.addScaledVector(this.normal, 0.03);
        this.jumpCooldown = 0.28;
        this.grounded = false;
        this.noise += 0.07;
      }
    } else {
      this.velocity.y -= GRAVITY * dt;
      this.velocity.addScaledVector(this.desired, dt * 1.5);
      if (wind) this.velocity.addScaledVector(wind, dt);
    }
    input.jumpQueued = false;
    this.speed = this.velocity.length();
    let stepped = false;
    if (this.grounded && moving && !attached && this.jumpCooldown <= 0) {
      this.travel.copy(this.velocity).normalize();
      this.probe
        .copy(this.position)
        .addScaledVector(this.travel, PLAYER_RADIUS + this.speed * dt + 0.025);
      this.probe.addScaledVector(this.normal, 0.65);
      this.direction.copy(this.normal).negate();
      const upper = this.collision.cast(this.probe, this.direction, 0.65 + PLAYER_RADIUS + 0.12);
      if (
        upper &&
        upper.normal.dot(this.normal) > 0.95 &&
        this.travel.subVectors(upper.point, this.position).dot(this.normal) > -PLAYER_RADIUS + 0.025
      ) {
        this.contact(upper);
        stepped = true;
      }
    }
    if (this.speed > 0.001 && !stepped) {
      this.direction.copy(this.velocity).divideScalar(this.speed);
      const ahead = this.collision.cast(
        this.position,
        this.direction,
        this.speed * dt + PLAYER_RADIUS + 0.015,
      );
      if (ahead) {
        this.contact(ahead);
      } else {
        this.motion.copy(this.velocity).multiplyScalar(dt);
        this.collision.moveSphere(this.position, this.motion, PLAYER_RADIUS);
      }
    }
    if (this.jumpCooldown <= 0 && !attached) {
      this.probe.copy(this.position).addScaledVector(this.normal, 0.08);
      this.direction.copy(this.normal).negate();
      const below = this.collision.cast(this.probe, this.direction, PLAYER_RADIUS + 0.24);
      if (below && (this.normal.y > 0.35 || below.normal.dot(this.normal) > 0.5))
        this.contact(below, true);
      else if (below && this.grounded && this.normal.y <= 0.35) {
        this.position.addScaledVector(this.normal, 0.002);
      } else if (this.grounded && moving) {
        this.travel
          .copy(this.velocity)
          .addScaledVector(this.normal, -this.velocity.dot(this.normal))
          .normalize();
        this.probe
          .copy(this.position)
          .addScaledVector(this.normal, -(PLAYER_RADIUS + 0.18))
          .addScaledVector(this.travel, PLAYER_RADIUS + 0.12);
        this.direction.copy(this.travel).negate();
        const edge = this.collision.cast(this.probe, this.direction, PLAYER_RADIUS + 0.5);
        if (edge) this.contact(edge);
        else this.grounded = false;
      } else this.grounded = false;
    }
    if (attached) this.grounded = false;
    this.resolvePenetration();
    this.distance += this.position.distanceTo(this.previous);
    if (moving && this.grounded) {
      const soft = SOFT_MATERIALS.has(this.material);
      this.noise += dt * (input.sneak ? 0.001 : input.sprint ? 0.045 : 0.008) * (soft ? 0.38 : 1);
    }
    this.position.x = THREE.MathUtils.clamp(this.position.x, -19.9, 19.9);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -23.9, 23.9);
    if (this.position.y < PLAYER_RADIUS) {
      this.position.y = PLAYER_RADIUS + 0.002;
      this.velocity.y = Math.max(0, this.velocity.y);
      this.normal.set(0, 1, 0);
      this.grounded = true;
      this.resolvePenetration();
    }
    if (this.grounded && this.normal.y > 0.9 && this.speed < 0.3) {
      this.safePosition.copy(this.position);
    }
  }

  resolvePenetration() {
    if (this.collision.resolveSphere(this.position, PLAYER_RADIUS, this.direction)) {
      const incoming = this.velocity.dot(this.direction);
      if (incoming < 0) this.velocity.addScaledVector(this.direction, -incoming);
      if (this.grounded && this.direction.dot(this.normal) > 0.5) {
        this.rotation.setFromUnitVectors(this.normal, this.direction);
        this.facing.applyQuaternion(this.rotation);
        this.normal.copy(this.direction);
      }
    }
  }

  interpolate(alpha) {
    this.renderPosition.lerpVectors(this.previous, this.position, alpha);
    this.axis.crossVectors(this.facing, this.normal).normalize();
    this.facing.crossVectors(this.normal, this.axis).normalize();
    this.matrix.makeBasis(this.facing, this.normal, this.axis);
    this.rotation.setFromRotationMatrix(this.matrix);
    this.orientation.slerp(this.rotation, 0.22);
    this.renderNormal.set(0, 1, 0).applyQuaternion(this.orientation);
  }
}
