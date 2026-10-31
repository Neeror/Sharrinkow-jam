import * as THREE from 'three';

export class FollowCamera {
  constructor(camera, collision) {
    this.camera = camera;
    this.collision = collision;
    this.target = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.lookDirection = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.ready = false;
  }

  update(player, input, dt, shake = 0) {
    this.desired
      .copy(player.renderPosition)
      .addScaledVector(player.renderNormal ?? player.normal, 0.32);
    if (!this.ready) {
      this.target.copy(this.desired);
      this.ready = true;
    } else {
      this.target.lerp(this.desired, 1 - Math.exp(-dt * 13));
    }
    this.collision.resolveSphere(this.target, 0.12);
    this.rotation.set(-input.pitch, -input.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.rotation);
    this.camera.up.set(0, 1, 0);
    this.lookDirection.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.direction.copy(this.lookDirection).negate();
    const obstacle = this.collision.cast(this.target, this.direction, 2.95);
    const distance = obstacle ? Math.max(0, Math.min(2.8, obstacle.distance - 0.15)) : 2.8;
    this.camera.position.copy(this.target).addScaledVector(this.direction, distance);
    this.collision.resolveSphere?.(this.camera.position, 0.12);
    if (shake > 0) {
      this.rotation.z = Math.sin(performance.now() * 0.13) * shake * 0.015;
      this.camera.quaternion.setFromEuler(this.rotation);
    }
  }
}
