import * as THREE from 'three';

export function makeSpider() {
  const group = new THREE.Group();
  group.scale.setScalar(0.31);
  const black = new THREE.MeshPhysicalMaterial({
    color: 0x070b10,
    roughness: 0.2,
    metalness: 0.22,
    clearcoat: 1,
  });
  const red = new THREE.MeshStandardMaterial({
    color: 0xb22121,
    roughness: 0.26,
    emissive: 0x280000,
  });
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  function ball(material, x, y, z, sx, sy, sz) {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }
  ball(black, -0.35, 0.2, 0, 0.63, 0.48, 0.47);
  ball(black, 0.3, 0.14, 0, 0.38, 0.28, 0.3);
  ball(black, 0.55, 0.08, 0, 0.2, 0.18, 0.24);
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.399;
    const z = Math.sin(angle) * 0.28;
    ball(
      red,
      -0.35 + Math.cos(angle) * 0.29,
      0.63 - Math.abs(z) * 0.24,
      z,
      0.095,
      0.025,
      0.065,
    ).rotation.x = z * 0.9;
  }
  const eye = new THREE.MeshPhysicalMaterial({ color: 0x40576c, metalness: 0.6, roughness: 0.05 });
  for (let i = 0; i < 8; i++)
    ball(
      eye,
      0.72 - Math.floor(i / 4) * 0.05,
      0.12 + Math.floor(i / 4) * 0.09,
      ((i % 4) - 1.5) * 0.083,
      0.035,
      0.035,
      0.035,
    );
  const legs = [];
  const cylinder = new THREE.CylinderGeometry(0.033, 0.019, 1, 7);
  const hairGeometry = new THREE.ConeGeometry(0.007, 0.08, 3);
  const dummy = new THREE.Object3D();
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const segments = [];
      for (let j = 0; j < 2; j++) {
        const mesh = new THREE.Mesh(cylinder, black);
        const fuzz = new THREE.InstancedMesh(hairGeometry, black, 32);
        for (let k = 0; k < 32; k++) {
          const angle = k * 2.4;
          dummy.position.set(Math.cos(angle) * 0.027, k / 32 - 0.5, Math.sin(angle) * 0.027);
          dummy.rotation.set(Math.sin(angle), angle, Math.cos(angle));
          dummy.updateMatrix();
          fuzz.setMatrixAt(k, dummy.matrix);
        }
        mesh.add(fuzz);
        mesh.castShadow = true;
        group.add(mesh);
        segments.push(mesh);
      }
      legs.push({
        side,
        index: i,
        root: new THREE.Vector3(0.3 - i * 0.18, 0.1, side * 0.19),
        foot: new THREE.Vector3(),
        knee: new THREE.Vector3(),
        segments,
      });
    }
  }
  const direction = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  function segment(a, b, mesh) {
    direction.subVectors(b, a);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.y = direction.length();
    mesh.quaternion.setFromUnitVectors(up, direction.normalize());
  }
  return {
    group,
    update(player) {
      group.position.copy(player.renderPosition);
      group.quaternion.copy(player.orientation);
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        const phase =
          player.distance * 13 + leg.index * Math.PI * 0.7 + (leg.side === 1 ? Math.PI : 0);
        leg.foot.set(
          0.8 - leg.index * 0.53 + Math.cos(phase) * 0.16,
          -0.43 + (player.grounded ? Math.max(0, Math.sin(phase)) * 0.2 : 0.25),
          leg.side * (1.03 + Math.sin(leg.index) * 0.15),
        );
        leg.knee.copy(leg.root).add(leg.foot).multiplyScalar(0.5);
        const distance = Math.min(leg.root.distanceTo(leg.foot), 1.65);
        leg.knee.y += Math.sqrt(Math.max(0.03, 0.81 - distance * distance * 0.25));
        leg.knee.z += leg.side * 0.18;
        segment(leg.root, leg.knee, leg.segments[0]);
        segment(leg.knee, leg.foot, leg.segments[1]);
      }
    },
  };
}
