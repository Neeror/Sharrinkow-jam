import * as THREE from 'three';

export class HumanThreat {
  constructor(scene, skin) {
    this.noise = 0;
    this.awake = 0;
    this.warning = 0;
    this.cooldown = 8;
    this.shake = 0;
    this.slow = 0;
    this.dodges = 0;
    this.strikes = 0;
    this.lastImpact = -10;
    this.target = new THREE.Vector3();
    this.reason = '';
    this.hand = new THREE.Group();
    this.shadow = new THREE.Group();
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x070911,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const sphere = new THREE.SphereGeometry(1, 18, 12);
    const disk = new THREE.CircleGeometry(1, 24);
    const part = (x, z, sx, sz) => {
      const mesh = new THREE.Mesh(sphere, skin);
      mesh.position.set(x, 0, z);
      mesh.scale.set(sx, 0.24, sz);
      mesh.castShadow = true;
      this.hand.add(mesh);
      const shadow = new THREE.Mesh(disk, this.shadowMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(x, 0, z);
      shadow.scale.set(sx, sz, 1);
      this.shadow.add(shadow);
    };
    part(0, 0, 1.05, 1.2);
    for (let i = 0; i < 4; i++) part(-0.7 + i * 0.45, -1.25, 0.2, 0.9 - i * 0.06);
    part(1.15, 0.2, 0.5, 0.3);
    this.hand.visible = this.shadow.visible = false;
    scene.add(this.hand, this.shadow);
    this.particles = new Float32Array(96 * 3);
    this.velocities = new Float32Array(96 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.particles, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.dust = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xcbb89d,
        size: 0.045,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    scene.add(this.dust);
  }

  reset() {
    this.noise = this.awake = this.warning = this.shake = this.slow = 0;
    this.cooldown = 8;
    this.dodges = 0;
    this.strikes = 0;
    this.lastImpact = -10;
    this.dust.material.opacity = 0;
    this.reason = '';
    this.hand.visible = this.shadow.visible = false;
  }

  warn(player) {
    if (this.warning > 0 || this.cooldown > 0) return;
    this.warning = 1;
    this.target.copy(player.position);
    this.strikes++;
  }

  update(dt, player, time, zone) {
    this.shake = Math.max(0, this.shake - dt * 2);
    this.slow = Math.max(0, this.slow - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    const nearBed =
      player.position.x > -2 &&
      player.position.x < 12 &&
      player.position.z < 5 &&
      player.position.z > -16;
    const multiplier = zone === 2 ? 2 : zone === 1 ? 1.5 : 1;
    this.noise = THREE.MathUtils.clamp(
      this.noise + player.noise * multiplier - dt * (player.speed < 0.2 ? 0.065 : 0.008),
      0,
      1,
    );
    this.awake = THREE.MathUtils.clamp(
      this.awake + dt * (this.noise > 0.5 ? (this.noise - 0.45) * 0.1 * multiplier : -0.006),
      0,
      1,
    );
    if (nearBed && this.noise > 0.64 && this.warning === 0) this.warn(player);
    if (this.warning > 0) {
      this.warning = Math.max(0, this.warning - dt);
      if (this.warning === 0) {
        this.shake = 1;
        this.cooldown = zone === 2 ? 5 : 8;
        this.lastImpact = time;
        const distance = Math.hypot(
          player.position.x - this.target.x,
          player.position.z - this.target.z,
        );
        if (distance < 1.6 && Math.abs(player.position.y - this.target.y) < 1.5)
          this.reason = 'Ладонь накрыла место, где ты шумел.';
        else {
          this.dodges++;
          this.slow = 0.7;
          this.noise *= 0.55;
        }
        for (let i = 0; i < 96; i++) {
          this.particles[i * 3] = this.target.x;
          this.particles[i * 3 + 1] = this.target.y;
          this.particles[i * 3 + 2] = this.target.z;
          this.velocities[i * 3] = Math.sin(i * 2.4) * 3;
          this.velocities[i * 3 + 1] = 0.5 + (i % 7) * 0.4;
          this.velocities[i * 3 + 2] = Math.cos(i * 2.4) * 3;
        }
      }
    }
    if (this.awake >= 1) this.reason = 'Человек полностью проснулся.';
    const impactAge = time - this.lastImpact;
    this.hand.visible = this.shadow.visible = this.warning > 0 || impactAge < 0.4;
    this.hand.position.copy(this.target);
    this.hand.position.y += this.warning > 0 ? 0.4 + this.warning * 8 : 0.1 + impactAge * 5;
    this.shadow.position.copy(this.target);
    this.shadow.position.y -= 0.12;
    this.shadowMaterial.opacity = this.warning > 0 ? 0.3 + (1 - this.warning) * 0.5 : 0.7;
    this.dust.material.opacity = Math.max(0, 1 - impactAge) * 0.7;
    if (impactAge < 1) {
      for (let i = 0; i < this.particles.length; i += 3) {
        this.velocities[i + 1] -= dt * 4;
        this.particles[i] += this.velocities[i] * dt;
        this.particles[i + 1] += this.velocities[i + 1] * dt;
        this.particles[i + 2] += this.velocities[i + 2] * dt;
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    }
  }
}
