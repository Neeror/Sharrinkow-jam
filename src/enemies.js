import * as THREE from 'three';

export class Enemies {
  constructor(world) {
    const b = world.builder;
    this.world = world;
    this.wind = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.cat = new THREE.Group();
    this.cat.position.set(3, 0, 15);
    b.scene.add(this.cat);
    const catMaterial = new THREE.MeshStandardMaterial({ color: 0x756759, roughness: 0.94 });
    const catOptions = { parent: this.cat };
    b.ball(catMaterial, [0, 1, 0], [0.72, 0.85, 1.45], catOptions);
    b.ball(catMaterial, [0, 1.6, -1.25], [0.7, 0.66, 0.62], catOptions);
    for (const x of [-0.45, 0.45]) {
      b.add(
        new THREE.ConeGeometry(0.3, 0.7, 3),
        catMaterial,
        [x, 2.25, -1.25],
        [1, 1, 0.6],
        catOptions,
      );
      b.ball('glow', [x * 0.7, 1.7, -1.83], [0.12, 0.09, 0.06], catOptions);
      for (const z of [-0.85, 0.9])
        b.ball(catMaterial, [x, 0.48, z], [0.23, 0.53, 0.25], catOptions);
      for (let i = 0; i < 3; i++)
        b.tube(
          'paper',
          [
            [x * 0.2, 1.4, -1.8],
            [x * 1.5, 1.45 + i * 0.08, -1.9],
          ],
          0.012,
          this.cat,
        );
    }
    this.tail = b.tube(
      catMaterial,
      [
        [0, 1, 1],
        [0.4, 1.2, 2],
        [0.8, 1.6, 2.6],
        [0.5, 2, 2.8],
      ],
      0.15,
      this.cat,
    );
    this.catMode = 'patrol';
    this.catInterest = 0;
    this.catGrace = 12;
    this.reason = '';
    this.warning = '';
    this.tapeTime = 0;
    this.lightExposure = 0;
    this.lampOn = false;
    this.swatWarning = 0;
    this.swatCooldown = 10;
    this.swatTarget = new THREE.Vector3();
    this.traps = [
      { x: -13, z: -3, sx: 3.5, sz: 0.65, type: 'tape' },
      { x: 13.5, z: -8, sx: 2.6, sz: 0.8, type: 'tape' },
      { x: -4, z: 6, sx: 1.5, sz: 1.2, type: 'trap' },
      { x: 15, z: 17, sx: 1.7, sz: 1.3, type: 'trap' },
    ];
    const tapeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xc6a774,
      roughness: 0.08,
      clearcoat: 1,
      transparent: true,
      opacity: 0.82,
    });
    for (const trap of this.traps) {
      b.box(
        trap.type === 'tape' ? tapeMaterial : 'wood',
        [trap.x, 0.045, trap.z],
        [trap.sx * 2, 0.07, trap.sz * 2],
        { dynamic: true, name: trap.type },
      );
      if (trap.type === 'trap') {
        b.tube(
          'metal',
          [
            [trap.x - 1, 0.12, trap.z - 0.7],
            [trap.x + 1, 0.12, trap.z - 0.7],
            [trap.x + 1, 0.12, trap.z + 0.7],
            [trap.x - 1, 0.12, trap.z + 0.7],
          ],
          0.045,
          b.scene,
        );
        b.ball('paper', [trap.x, 0.15, trap.z], [0.3, 0.15, 0.25], { dynamic: true });
      }
    }
    const fan = new THREE.Group();
    fan.position.set(-5.5, 5.7, -20);
    b.scene.add(fan);
    b.add('cylinder', 'metal', [0, -0.8, 0], [0.08, 1.6, 0.08], { parent: fan });
    b.ball('black', [0, -1.1, 0], [0.9, 0.15, 0.7], { parent: fan });
    for (const radius of [0.6, 1.15, 1.3])
      b.add(new THREE.TorusGeometry(radius, 0.025, 4, 40), 'metal', [0, 0.4, 0], [1, 1, 1], {
        parent: fan,
      });
    for (let i = 0; i < 10; i++)
      b.box('metal', [0, 0.4, 0.03], [0.025, 2.6, 0.025], {
        parent: fan,
        rotation: [0, 0, (i * Math.PI) / 10],
      });
    this.blades = new THREE.Group();
    this.blades.position.y = 0.4;
    fan.add(this.blades);
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      b.ball('black', [Math.sin(angle) * 0.55, Math.cos(angle) * 0.55, -0.08], [0.3, 0.65, 0.06], {
        parent: this.blades,
        rotation: [0, 0, -angle],
      });
    }
    this.swatter = new THREE.Group();
    b.scene.add(this.swatter);
    b.box('sofa', [0, 0, 0], [2, 0.08, 2.8], { parent: this.swatter });
    b.box('wood', [0, 0, 3], [0.18, 0.15, 4], { parent: this.swatter });
    for (let i = 0; i < 9; i++)
      b.box('black', [-0.85 + i * 0.2, 0.05, 0], [0.055, 0.015, 2.6], { parent: this.swatter });
    this.swatter.visible = false;
    this.swatMark = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.25, 40),
      new THREE.MeshBasicMaterial({
        color: 0xf49a74,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    this.swatMark.rotation.x = -Math.PI / 2;
    this.swatMark.visible = false;
    b.scene.add(this.swatMark);
    b.finish();
  }

  reset() {
    this.cat.position.set(3, 0, 15);
    this.catInterest = this.tapeTime = this.lightExposure = this.swatWarning = 0;
    this.catGrace = 12;
    this.swatCooldown = 10;
    this.reason = this.warning = '';
    this.catMode = 'patrol';
    this.lampOn = false;
    this.wind.set(0, 0, 0);
    this.world.lamp.intensity = this.world.root ? 2.5 : 40;
    this.swatter.visible = this.swatMark.visible = false;
  }

  update(dt, time, player, threat, zone, attached) {
    this.warning = '';
    this.catGrace = Math.max(0, this.catGrace - dt);
    const catDistance = Math.hypot(
      this.cat.position.x - player.position.x,
      this.cat.position.z - player.position.z,
    );
    if (player.position.y < 2 && threat.noise > 0.12 && catDistance < 12) {
      this.catInterest = 5;
      this.target.copy(player.position);
    }
    this.catInterest = Math.max(0, this.catInterest - dt);
    this.catMode = this.catInterest > 0 ? 'chase' : 'patrol';
    if (this.catInterest === 0)
      this.target.set(Math.sin(time * 0.045) * 8, 0, 13 + Math.cos(time * 0.055) * 6);
    this.direction.subVectors(this.target, this.cat.position);
    this.direction.y = 0;
    const length = this.direction.length();
    if (length > 0.2) {
      this.direction.divideScalar(length);
      this.cat.position.addScaledVector(this.direction, dt * (this.catInterest > 0 ? 2.45 : 0.55));
      this.cat.rotation.y = Math.atan2(-this.direction.x, -this.direction.z);
    }
    this.tail.rotation.z = Math.sin(time * 2) * 0.12;
    if (catDistance < 5 && player.position.y < 2)
      this.warning = 'КОТ РЯДОМ · УХОДИ НА МЕБЕЛЬ ИЛИ СТЕНУ';
    if (catDistance < 1 && player.position.y < 1.65 && this.catGrace === 0)
      this.reason = 'Кот поймал каракурта.';
    let onTape = false;
    for (const trap of this.traps) {
      if (
        player.position.y > 0.42 ||
        Math.abs(player.position.x - trap.x) > trap.sx ||
        Math.abs(player.position.z - trap.z) > trap.sz
      )
        continue;
      if (trap.type === 'trap') this.reason = 'Ты попал в ловушку на полу.';
      else onTape = true;
    }
    this.tapeTime = onTape ? this.tapeTime + dt : 0;
    if (onTape) {
      player.slow = 0.15;
      this.warning = 'ЛИПКАЯ ЛЕНТА · ПРЫЖОК ИЛИ НИТЬ, ПОКА НЕ ПОЗДНО';
      if (this.tapeTime > 2.8) this.reason = 'Липкая лента не отпустила.';
    }
    const lampPhase = time % 22;
    this.lampOn = lampPhase > 15 && lampPhase < 20;
    this.world.lamp.intensity = (this.lampOn ? 150 : 40) * (this.world.root ? 0.0625 : 1);
    const lit =
      Math.hypot(player.position.x - 14, player.position.z - 9) < 5.5 && player.position.y > 2.8;
    if (lit && lampPhase > 13 && lampPhase <= 15) this.warning = 'ЛАМПА ВОТ-ВОТ ВСПЫХНЕТ · ЗАМРИ';
    if (lit && this.lampOn) {
      this.warning = 'НА СВЕТУ НЕЛЬЗЯ ДВИГАТЬСЯ';
      this.lightExposure =
        player.speed > 0.35 ? this.lightExposure + dt : Math.max(0, this.lightExposure - dt * 2);
      if (this.lightExposure > 1.2) {
        threat.awake += dt * 0.15;
        threat.noise = Math.max(threat.noise, 0.8);
      }
      if (this.lightExposure > 3) this.reason = 'Человек заметил движение в свете лампы.';
    } else this.lightExposure = Math.max(0, this.lightExposure - dt);
    this.wind.set(0, 0, 0);
    if (player.position.x > 12 && player.position.z > -8 && player.position.z < 10)
      this.wind.x = -1.8 - Math.sin(time * 0.8) * 1.4;
    if (
      player.position.x > -10 &&
      player.position.x < -2 &&
      player.position.z > -20 &&
      player.position.z < -8 &&
      player.position.y > 2
    )
      this.wind.z = 3.2 + Math.sin(time * 1.2);
    if (attached && this.wind.lengthSq() > 2)
      this.warning = 'ПОТОК ВОЗДУХА · НИТЬ СНОСИТ В СТОРОНУ';
    this.blades.rotation.z += dt * 18;
    this.swatCooldown = Math.max(0, this.swatCooldown - dt);
    if (
      zone >= 1 &&
      player.position.y > 3 &&
      player.position.x > -1 &&
      player.position.x < 11 &&
      player.position.z < 5 &&
      threat.noise > 0.38 &&
      this.swatCooldown === 0 &&
      this.swatWarning === 0
    ) {
      this.swatWarning = 1.4;
      this.swatTarget.copy(player.position);
    }
    if (this.swatWarning > 0) {
      this.warning = 'МУХОБОЙКА · УЙДИ ИЗ КРАСНОГО КРУГА';
      this.swatWarning = Math.max(0, this.swatWarning - dt);
      this.swatter.position.copy(this.swatTarget);
      this.swatter.position.y += 0.15 + this.swatWarning * 4;
      this.swatMark.position.copy(this.swatTarget);
      this.swatMark.position.y -= 0.12;
      if (this.swatWarning === 0) {
        this.swatCooldown = 13;
        threat.shake = 0.7;
        if (player.position.distanceTo(this.swatTarget) < 1.5)
          this.reason = 'Мухобойка накрыла тебя.';
      }
    }
    this.swatter.visible = this.swatMark.visible = this.swatWarning > 0;
  }
}
