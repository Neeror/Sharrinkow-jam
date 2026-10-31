import * as THREE from 'three';
import { makeMaterials, randomSource } from './materials.js';
import { WorldBuilder } from './world-builder.js';
import { makeFurniture } from './furniture.js';
import { makeHuman } from './human.js';

export function makeWorld(scene) {
  const materials = makeMaterials();
  const builder = new WorldBuilder(scene, materials);
  const solid = { solid: true };
  builder.add('box', 'floor', [0, -0.3, 0], [40, 0.6, 48], { ...solid, name: 'Паркет' });
  builder.add('box', 'wall', [0, 7, -24.2], [40.6, 14, 0.4], solid);
  builder.add('box', 'wall', [0, 7, 24.2], [40.6, 14, 0.4], solid);
  builder.add('box', 'wall', [20.2, 7, 0], [0.4, 14, 48], solid);
  builder.add('box', 'wall', [-20.2, 7, 0], [0.4, 14, 48], solid);
  builder.add('box', 'wall', [0, 14.2, 0], [40, 0.4, 48], solid);
  for (const z of [-23.9, 23.9]) builder.box('trim', [0, 0.3, z], [40, 0.6, 0.18]);
  for (const x of [-19.9, 19.9]) builder.box('trim', [x, 0.3, 0], [0.18, 0.6, 48]);
  for (let i = 0; i < 24; i++)
    builder.add('box', 'darkWood', [0, 0.002, -23 + i * 2], [40, 0.005, 0.025], { shadow: false });
  for (let row = 0; row < 24; row++) {
    for (let column = 0; column < 5; column++)
      builder.add(
        'box',
        'darkWood',
        [-19 + column * 8 + (row % 2) * 3, 0.003, -22 + row * 2],
        [0.025, 0.005, 2],
        { shadow: false },
      );
  }
  builder.box('darkWood', [-7, 4.9, 23.85], [6.1, 9.8, 0.24], { name: 'Дверь' });
  for (const x of [-10.2, -3.8]) builder.box('trim', [x, 5.1, 23.6], [0.3, 10.2, 0.35]);
  builder.box('trim', [-7, 10.2, 23.6], [6.7, 0.3, 0.35]);
  builder.box('brass', [-4.6, 4.8, 23.55], [0.65, 0.15, 0.15]);
  for (const y of [2.8, 7.2]) builder.box('wood', [-7, y, 23.68], [4.8, 3.5, 0.1]);
  builder.box('black', [19.95, 8.7, 1], [0.05, 8.4, 13], { name: 'Окно' });
  builder.box('glass', [19.8, 8.7, 1], [0.05, 8, 12.6]);
  for (const y of [4.6, 8.7, 12.8]) builder.box('trim', [19.65, y, 1], [0.3, 0.18, 13]);
  for (const z of [-5.5, 1, 7.5]) builder.box('trim', [19.65, 8.7, z], [0.3, 8.4, 0.18]);
  builder.box('trim', [19.1, 4.6, 1], [1.7, 0.35, 14], solid);
  const curtain = new THREE.Group();
  scene.add(curtain);
  const curtainMaterial = materials.sheet.clone();
  curtainMaterial.side = THREE.DoubleSide;
  for (const center of [-5.3, 7.2]) {
    const geometry = new THREE.PlaneGeometry(3.5, 11.7, 32, 12);
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 8) * 0.28);
    geometry.computeVertexNormals();
    builder.add(geometry, curtainMaterial, [18.8, 6.4, center], [1, 1, 1], {
      parent: curtain,
      rotation: [0, -Math.PI / 2, 0],
      name: 'Занавеска',
    });
  }
  makeFurniture(builder);
  const human = makeHuman(builder);
  const clock = builder.add('cylinder', 'brass', [0, 10, -23.7], [1, 0.15, 1], {
    rotation: [Math.PI / 2, 0, 0],
    name: 'Часы',
  });
  builder.box('paper', [0, 10, -23.57], [0.04, 0.8, 0.04]);
  builder.box('paper', [0.25, 10.05, -23.55], [0.55, 0.04, 0.04]);
  builder.finish();

  scene.background = new THREE.Color(0x111b26);
  scene.fog = new THREE.FogExp2(0x172230, 0.013);
  scene.add(new THREE.HemisphereLight(0xb7cde1, 0x594638, 1.4));
  const moon = new THREE.DirectionalLight(0x9cbfec, 2.1);
  moon.position.set(18, 18, 4);
  moon.target.position.set(-4, 0, -6);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, {
    left: -29,
    right: 29,
    top: 29,
    bottom: -29,
    near: 0.5,
    far: 70,
  });
  moon.shadow.normalBias = 0.035;
  moon.shadow.bias = -0.0002;
  scene.add(moon, moon.target);
  const lamp = new THREE.PointLight(0xffca88, 40, 22, 2);
  lamp.position.set(15, 6, 9.8);
  scene.add(lamp);
  const phone = new THREE.PointLight(0x83cce9, 5, 7, 2);
  phone.position.set(13, 4.2, 8);
  scene.add(phone);
  const rayMaterial = new THREE.MeshBasicMaterial({
    color: 0x88acdb,
    transparent: true,
    opacity: 0.035,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 3; i++) {
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 3.2, 23, 12, 1, true), rayMaterial);
    ray.position.set(9, 6, -3 + i * 4);
    ray.rotation.z = -0.95;
    scene.add(ray);
  }
  const random = randomSource(44);
  const positions = new Float32Array(1300 * 3);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (random() - 0.5) * 39;
    positions[i + 1] = random() * 13;
    positions[i + 2] = (random() - 0.5) * 47;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xc6d7dc,
      size: 0.024,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  scene.add(dust);
  return {
    builder,
    materials,
    human,
    lamp,
    moon,
    dust,
    clock,
    solids: builder.solids,
    update(time, player, alert = 0) {
      human.update(time, player, alert);
      curtain.rotation.y = Math.sin(time * 0.8) * 0.025;
      dust.position.y = Math.sin(time * 0.1) * 0.18;
      builder.sync();
    },
    quality(level) {
      human.hair.count = level === 'low' ? 6500 : level === 'medium' ? 14000 : 24000;
      geometry.setDrawRange(0, level === 'low' ? 400 : 1300);
    },
  };
}
