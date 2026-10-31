import * as THREE from 'three';

export const ENDING_DURATION = 9;
export const BITE_TIME = 3.8;
export const smooth = (a, b, t) => {
  const x = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

export class Ending {
  constructor(world, spider, camera, sound, storage) {
    Object.assign(this, { world, spider, camera, sound, storage });
    this.time = 0;
    this.active = false;
    this.target = new THREE.Vector3();
    this.startPosition = new THREE.Vector3();
    this.startCamera = new THREE.Vector3();
    this.closeCamera = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.rotation = new THREE.Quaternion();
    this.skin = [];
    this.point = new THREE.Vector3();
    this.baseHumanPosition = new THREE.Vector3();
    this.world.human.root.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.name.startsWith('Body')) return;
      mesh.geometry = mesh.geometry.clone();
      const source = mesh.geometry.attributes.position;
      const positions = new Float32Array(source.count * 3);
      for (let i = 0; i < source.count; i++) {
        positions[i * 3] = source.getX(i);
        positions[i * 3 + 1] = source.getY(i);
        positions[i * 3 + 2] = source.getZ(i);
      }
      mesh.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.skin.push({
        mesh,
        original: mesh.geometry.attributes.position.array.slice(),
        affected: [],
      });
    });
    this.bones = [];
    world.human.root.traverse((object) => {
      if (object.isBone && /DEF.*(hand|finger|thumb|palm)/i.test(object.name)) {
        this.bones.push({ bone: object, rotation: object.quaternion.clone() });
      }
    });
    const material = new THREE.MeshStandardMaterial({ color: 0x624542, roughness: 0.9 });
    this.mark = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), material);
    this.mark.scale.set(1, 0.12, 1);
    this.mark.visible = false;
    world.root.add(this.mark);
    this.overlay = document.getElementById('cinema-fade');
    this.hint = document.getElementById('cinema-hint');
    window.addEventListener('keydown', (event) => {
      if (!this.active || event.repeat || !['Escape', 'Space'].includes(event.code)) return;
      event.preventDefault();
      if (this.canSkip && this.time >= 1.5) this.time = ENDING_DURATION;
    });
  }

  begin(player) {
    this.reset();
    this.active = true;
    try {
      this.canSkip = this.storage.getItem('ruka-cela-ending-seen') === '1';
    } catch {
      this.canSkip = false;
    }
    this.startPosition.copy(player.renderPosition);
    this.target.copy(player.position).add(new THREE.Vector3(0.18, -0.08, 0));
    this.startCamera.copy(this.camera.position);
    this.closeCamera.copy(this.target).add(new THREE.Vector3(-1.1, 1.45, 1.65));
    if (this.startCamera.distanceTo(this.target) > 5)
      this.startCamera.copy(this.target).add(new THREE.Vector3(-2.1, 2.2, 2.7));
    document.getElementById('debug-controls')?.setAttribute('hidden', '');

    this.rotation.copy(this.spider.group.quaternion);
    this.lampIntensity = this.world.lamp.intensity;
    this.baseHumanPosition.copy(this.world.human.root.position);
    this.world.root.updateMatrixWorld(true);
    for (const entry of this.skin) {
      entry.affected.length = 0;
      const positions = entry.mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        entry.mesh.getVertexPosition(i, this.point);
        this.point.applyMatrix4(entry.mesh.matrixWorld);
        this.world.root.worldToLocal(this.point);
        const distance = Math.hypot(this.point.x - this.target.x, this.point.z - this.target.z);
        if (distance < 0.18 && Math.abs(this.point.y - this.target.y) < 0.4)
          entry.affected.push([i, 1 - distance / 0.18]);
      }
    }
    document.body.classList.add('cinematic');
    this.hint.textContent = this.canSkip
      ? 'ESC / ПРОБЕЛ — ПРОПУСТИТЬ ПОСЛЕ 1,5 С'
      : 'ПОСЛЕДНЕЕ ПРИКОСНОВЕНИЕ';
    this.sound.endingStart();
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const approach = smooth(0.5, 2.6, t);
    const rise = smooth(2.6, 3.5, t) * (1 - smooth(3.8, 4.1, t));
    const impact = smooth(3.78, 3.83, t) * (1 - smooth(3.83, 4.15, t));
    const reaction = smooth(3.85, 4.02, t) * (1 - smooth(4.15, 5.3, t));
    this.spider.group.position.lerpVectors(this.startPosition, this.target, approach);
    this.spider.group.position.y += 0.08 + rise * 0.13 - impact * 0.06;
    this.spider.group.quaternion.copy(this.rotation);
    this.spider.group.rotateZ(rise * 0.3 - impact * 0.2);
    this.spider.bitePose(rise, impact);
    for (const { bone, rotation } of this.bones) {
      bone.quaternion.copy(rotation);
      const curl = /hand/i.test(bone.name) ? reaction * 0.16 : reaction * 0.55;
      bone.rotateX(curl);
    }
    this.world.human.root.position.copy(this.baseHumanPosition);
    this.world.human.root.position.y += reaction * 0.035;
    for (const { mesh, original, affected } of this.skin) {
      const positions = mesh.geometry.attributes.position;
      for (const [index, weight] of affected) {
        positions.setY(index, original[index * 3 + 1] - impact * weight * 0.003);
      }
      if (affected.length) positions.needsUpdate = true;
    }
    this.mark.visible = t >= BITE_TIME;
    this.mark.position.copy(this.target);
    this.mark.position.y -= 0.068 + impact * 0.015;
    this.camera.position.lerpVectors(this.startCamera, this.closeCamera, smooth(0, 2.8, t));
    this.camera.position.x += Math.sin(t * 190) * impact * 0.055;
    this.camera.position.y += Math.cos(t * 147) * impact * 0.035;
    this.look.copy(this.target);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.look);
    this.world.lamp.intensity = t >= 3.85 && t < 4.85 ? 8 : this.lampIntensity;
    this.overlay.style.opacity = String(smooth(6.5, 8.5, t));
    this.overlay.style.background = t > 3.8 && t < 3.88 ? '#e4edf2' : '#000';
    if (t > 3.8 && t < 3.88) this.overlay.style.opacity = '0.25';
    this.world.dust.position.y = Math.sin(t * 0.025) * 0.02;
    this.sound.endingUpdate(t);
    if (t < ENDING_DURATION) return false;
    try {
      this.storage.setItem('ruka-cela-ending-seen', '1');
    } catch {}
    this.active = false;
    this.world.lamp.intensity = this.lampIntensity;
    document.body.classList.remove('cinematic');
    this.sound.silence();
    return true;
  }

  reset() {
    this.active = false;
    this.time = 0;
    this.mark.visible = false;
    this.overlay.style.opacity = '0';
    document.body.classList.remove('cinematic');
    for (const { bone, rotation } of this.bones) bone.quaternion.copy(rotation);
    if (this.lampIntensity !== undefined) this.world.lamp.intensity = this.lampIntensity;
    this.spider.bitePose(0, 0);
    for (const { mesh, original } of this.skin) {
      mesh.geometry.attributes.position.array.set(original);
      mesh.geometry.attributes.position.needsUpdate = true;
    }
    if (this.lampIntensity !== undefined)
      this.world.human.root.position.copy(this.baseHumanPosition);
  }
}
