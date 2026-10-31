import * as THREE from 'three';
import { randomSource } from './materials.js';
import { blanketHeight } from './surfaces.js';

export function makeHuman(builder) {
  const root = new THREE.Group();
  root.name = 'Спящий человек';
  builder.scene.add(root);
  const moving = { parent: root, solid: true };
  const torso = builder.ball('skin', [4.7, 4.15, -5.8], [2.5, 1.25, 4.2], moving);
  builder.ball('skin', [4.7, 4.35, -9.5], [0.75, 0.75, 1], moving);
  const head = builder.ball('skin', [4.7, 4.5, -10.9], [1.45, 1.2, 1.7], moving);
  builder.ball('hair', [4.7, 4.7, -11.6], [1.48, 1.13, 1.12], { parent: root });
  builder.ball('skin', [4.7, 5.55, -10.45], [0.28, 0.4, 0.5], { parent: root });
  for (const x of [4.12, 5.28]) {
    builder.tube(
      'hair',
      [
        [x - 0.24, 5.45, -10.85],
        [x, 5.49, -10.72],
        [x + 0.24, 5.45, -10.82],
      ],
      0.034,
      root,
    );
    builder.ball('skin', [x < 4.7 ? 3.26 : 6.14, 4.5, -10.9], [0.28, 0.45, 0.4], { parent: root });
  }
  builder.tube(
    'sofa',
    [
      [4.25, 5.4, -9.9],
      [4.7, 5.46, -9.83],
      [5.15, 5.4, -9.9],
    ],
    0.035,
    root,
  );
  builder.ball('skin', [1.8, 4, -6], [0.7, 0.65, 3.2], moving);
  builder.ball('skin', [2, 3.9, -2], [0.62, 0.55, 2], moving);
  const arm = new THREE.Group();
  root.add(arm);
  const armOptions = { parent: arm, solid: true };
  builder.ball('skin', [7.5, 4.2, -6.6], [0.95, 0.85, 2.6], armOptions);
  builder.ball('skin', [8.6, 4.05, -2.7], [0.73, 0.65, 2.5], armOptions);
  const palm = builder.ball('skin', [8.6, 3.9, 0.25], [1, 0.48, 1.15], armOptions);
  for (let i = 0; i < 4; i++) {
    builder.ball(
      'skin',
      [7.9 + i * 0.45, 3.86, 1.5 + Math.sin(i) * 0.18],
      [0.19, 0.25, 1],
      armOptions,
    );
  }
  builder.ball('skin', [9.65, 3.88, 0.15], [0.27, 0.3, 0.85], {
    ...armOptions,
    rotation: [0, -0.7, 0],
  });
  for (const z of [-1, -0.75, 0.7])
    builder.tube(
      'sofa',
      [
        [8.05, 4.37, z],
        [8.55, 4.43, z + 0.07],
        [9.08, 4.37, z],
      ],
      0.012,
      arm,
    );

  const blanket = new THREE.PlaneGeometry(11.5, 12.5, 80, 90);
  blanket.rotateX(-Math.PI / 2);
  const positions = blanket.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) + 4.7;
    const z = positions.getZ(i) - 1.3;
    positions.setXYZ(i, x, blanketHeight(x, z), z);
  }
  blanket.computeVertexNormals();
  const cover = builder.add(blanket, 'cloth', [0, 0, 0], [1, 1, 1], {
    parent: root,
    name: 'Одеяло',
  });
  builder.solids.push({
    mesh: cover,
    inverse: new THREE.Matrix4(),
    type: 'heightfield',
    height: blanketHeight,
    minX: -1.05,
    maxX: 10.45,
    minZ: -7.55,
    maxZ: 4.95,
    material: 'cloth',
    moving: true,
  });
  const random = randomSource(37);
  const hairGeometry = new THREE.ConeGeometry(0.006, 0.16, 3);
  hairGeometry.translate(0, 0.08, 0);
  const hairMaterial = builder.materials.hair.clone();
  const uniforms = { time: { value: 0 }, spider: { value: new THREE.Vector3() } };
  hairMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.hairTime = uniforms.time;
    shader.uniforms.spiderPosition = uniforms.spider;
    shader.vertexShader = `uniform float hairTime; uniform vec3 spiderPosition;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vec3 root = instanceMatrix[3].xyz;
      float nearSpider = exp(-length(root - spiderPosition) * 4.0);
      transformed.x += position.y * position.y * (sin(hairTime * 1.3 + root.z) * 1.2 + nearSpider * 8.0);
    `,
    );
  };
  const hair = new THREE.InstancedMesh(hairGeometry, hairMaterial, 24000);
  const dummy = new THREE.Object3D();
  const normal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 24000; i++) {
    const angle = random() * Math.PI;
    const v = random() * 2 - 1;
    const ring = Math.sqrt(1 - v * v);
    dummy.position.set(
      8.6 + Math.cos(angle) * ring * 0.74,
      4.05 + Math.sin(angle) * ring * 0.66,
      -2.7 + v * 2.5,
    );
    normal
      .set((Math.cos(angle) * ring) / 0.74, (Math.sin(angle) * ring) / 0.66, v / 2.5)
      .normalize();
    dummy.quaternion.setFromUnitVectors(up, normal);
    dummy.scale.setScalar(0.6 + random() * 0.7);
    dummy.updateMatrix();
    hair.setMatrixAt(i, dummy.matrix);
  }
  arm.add(hair);
  return {
    root,
    arm,
    head,
    torso,
    palm,
    cover,
    hair,
    update(time, player, alert = 0) {
      root.position.y = Math.sin(time * 1.3) * 0.055;
      torso.scale.y = 1.25 + Math.sin(time * 1.3) * 0.045;
      root.rotation.z = Math.sin(time * 0.27) * alert * 0.018;
      arm.position.y = Math.max(0, Math.sin(time * 0.42)) * alert * 0.65;
      head.rotation.z = Math.sin(time * 0.24) * alert * 0.15;
      uniforms.time.value = time;
      if (player) uniforms.spider.value.copy(player);
    },
  };
}
