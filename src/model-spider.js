import * as THREE from 'three';
import { SPIDER_SCALE } from './assets.js';
import { METERS_PER_SIMULATION_UNIT } from './model-world.js';

export function makeModelSpider(assets) {
  const group = new THREE.Group();
  const model = assets.instantiate('spider');
  const object = model.userData.model;
  const bounds = new THREE.Box3().setFromObject(model, true);
  const size = bounds.getSize(new THREE.Vector3());
  const factor = SPIDER_SCALE / Math.max(size.x, size.y, size.z) / METERS_PER_SIMULATION_UNIT;
  model.scale.setScalar(factor);
  model.updateMatrixWorld(true);
  const left = object.getObjectByName('Black_Widow_Spider_LArmCollarbone_041');
  const right = object.getObjectByName('Black_Widow_Spider_RArmCollarbone_045');
  const tail = object.getObjectByName('Black_Widow_Spider_Tail1_049');
  const heading = new THREE.Vector3();
  if (left && right && tail) {
    heading
      .addVectors(
        left.getWorldPosition(new THREE.Vector3()),
        right.getWorldPosition(new THREE.Vector3()),
      )
      .multiplyScalar(0.5)
      .sub(tail.getWorldPosition(new THREE.Vector3()));
    model.rotation.y = Math.atan2(heading.z, heading.x);
  } else {
    model.rotation.y = -Math.PI / 2;
  }
  model.position.y = -0.14;
  group.add(model);
  const mixer = new THREE.AnimationMixer(object);
  const source = model.userData.animations[0];
  const clip = source.clone();
  clip.tracks = clip.tracks.filter(
    (track) =>
      !track.name.includes('PhysCamera') &&
      !track.name.includes('Hub001') &&
      !track.name.endsWith('.scale'),
  );
  const action = mixer.clipAction(clip);
  action.play();
  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    mesh.material = mesh.material.clone();
    mesh.material.roughness = 0.28;
    mesh.material.metalness = 0.12;
  });
  const jaws = [-1, 1].map((side) => {
    const jaw = new THREE.Mesh(
      new THREE.ConeGeometry(0.018, 0.09, 8),
      new THREE.MeshStandardMaterial({ color: 0x17171c, roughness: 0.24 }),
    );
    jaw.position.set(0.13, -0.015, side * 0.035);
    jaw.rotation.z = -Math.PI / 2;
    group.add(jaw);
    return jaw;
  });
  const frontLegs = [left, right]
    .filter(Boolean)
    .map((bone) => ({ bone, rotation: bone.quaternion.clone() }));
  let lastDistance = 0;
  return {
    group,
    bitePose(rise, impact) {
      for (const { bone, rotation } of frontLegs) {
        bone.quaternion.copy(rotation);
        bone.rotateZ(rise * 0.45 - impact * 0.18);
      }
      for (let i = 0; i < jaws.length; i++) {
        jaws[i].rotation.y = (i === 0 ? -1 : 1) * (rise * 0.7 - impact * 0.3);
      }
    },
    update(player) {
      group.position.copy(player.renderPosition);
      group.quaternion.copy(player.orientation);
      const traveled = Math.abs(player.distance - lastDistance);
      lastDistance = player.distance;
      if (player.grounded && traveled < 1) mixer.update(traveled * 0.7);
    },
  };
}
