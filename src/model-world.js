import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterials } from './materials.js';
import { WorldBuilder } from './world-builder.js';
import { makeModelHuman } from './model-human.js';
import { bakeCollisionGeometry } from './collision-geometry.js';
import { buildShellCollider } from './colliders.js';
import { makeDeskColliders } from './desk-colliders.js';
import { makeSofaColliders } from './sofa-colliders.js';
import { makeBedFrameColliders } from './bed-colliders.js';

export const METERS_PER_SIMULATION_UNIT = 0.15;

export function makeModelWorld(scene, assets) {
  const materials = makeMaterials();
  const root = new THREE.Group();
  root.scale.setScalar(METERS_PER_SIMULATION_UNIT);
  scene.add(root);
  const builder = new WorldBuilder(root, materials);
  const models = new Map();
  const solid = { solid: true };
  builder.add('box', 'floor', [0, -0.2, 0], [40, 0.4, 48], solid);
  builder.add('box', 'wall', [0, 9, -24.2], [40.4, 18, 0.4], solid);
  builder.add('box', 'wall', [0, 9, 24.2], [40.4, 18, 0.4], solid);
  builder.add('box', 'wall', [-20.2, 9, 0], [0.4, 18, 48], solid);
  builder.add('box', 'wall', [20.2, 9, 0], [0.4, 18, 48], solid);
  builder.add('box', 'wall', [0, 18.2, 0], [40, 0.4, 48], solid);
  for (const z of [-23.9, 23.9]) builder.box('trim', [0, 0.3, z], [40, 0.6, 0.12]);
  for (const x of [-19.9, 19.9]) builder.box('trim', [x, 0.3, 0], [0.12, 0.6, 48]);
  builder.box('darkWood', [-7, 6.8, 23.9], [6, 13.6, 0.12]);
  builder.box('brass', [-4.7, 6.5, 23.7], [0.65, 0.12, 0.15]);
  builder.box('rug', [-1, 0.035, 12], [15, 0.07, 12], solid);
  builder.box('wood', [16.5, 6.4, -18], [5.8, 12.8, 8], solid);
  for (const z of [-20, -16]) builder.box('darkWood', [13.55, 6.4, z], [0.12, 12.5, 3.8]);
  builder.box('wood', [14, 1.8, 9], [5.5, 3.6, 5.2], solid);
  for (let index = 0; index < 3; index++) {
    builder.box('darkWood', [11.2, 0.6 + index * 1.1, 9], [0.1, 0.9, 4.9]);
    builder.box('brass', [11.1, 0.6 + index * 1.1, 9], [0.1, 0.1, 1]);
  }

  function place(name, position, rotation = 0, height = null, material = 'wood') {
    const model = assets.instantiate(name, height);
    model.scale.multiplyScalar(1 / METERS_PER_SIMULATION_UNIT);
    model.position.fromArray(position);
    model.rotation.y = rotation;
    root.add(model);
    model.updateMatrixWorld(true);
    const geometries = [];
    const bedding = [];
    const inverseRoot = root.matrixWorld.clone().invert();
    if (name === 'desk' || name === 'sofa') {
      const transform = new THREE.Matrix4().multiplyMatrices(inverseRoot, model.matrixWorld);
      builder.solids.push(
        ...(name === 'desk'
          ? makeDeskColliders(transform, material)
          : makeSofaColliders(transform)),
      );
    }
    model.traverse((mesh) => {
      if (name === 'desk' || name === 'sofa' || !mesh.isMesh || mesh.isSkinnedMesh) return;
      const transform = new THREE.Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld);
      const geometry = bakeCollisionGeometry(mesh, transform);
      if (name === 'bed' && /^(blanket|cover|sheet|mattress)_/.test(mesh.name))
        bedding.push(geometry);
      else geometries.push(geometry);
    });
    if (name === 'bed') {
      if (bedding.length) {
        geometries.push(mergeGeometries(bedding));
        for (const part of bedding) part.dispose();
      }
      for (const part of geometries) {
        part.boundsTree = new MeshBVH(part, { maxLeafTris: 12 });
        const geometry = buildShellCollider(part, 0.2);
        builder.solids.push({
          type: 'mesh',
          closed: true,
          name,
          geometry,
          inverse: new THREE.Matrix4(),
          material,
        });
        part.dispose();
      }
      geometries.length = 0;
    }
    if (geometries.length) {
      const detailed = mergeGeometries(geometries);
      detailed.boundsTree = new MeshBVH(detailed, { maxLeafTris: 12 });
      const geometry = buildShellCollider(detailed, 0.2);
      builder.solids.push({
        type: 'mesh',
        closed: name !== 'bed',
        name,
        geometry,
        inverse: new THREE.Matrix4(),
        material,
      });
      detailed.dispose();
      for (const part of geometries) part.dispose();
    }
    models.set(name, model);
    builder.objects.push(name);
    return model;
  }

  const bed = place('bed', [4.5, 0, -5], -Math.PI / 2, null, 'cloth');
  builder.solids.push(...makeBedFrameColliders());
  place('sofa', [-15.4, 0, 6], Math.PI / 2, null, 'sofa');
  place('desk', [-8.5, 0, -19], 0, null, 'metal');
  place('shelves', [-17.5, 0, -11], Math.PI / 2, 2.1, 'metal');
  const lampModel = place('lamp', [15, 3.6, 9.8]);
  place('picture', [2, 10.8, -23.7]);
  const secondPicture = assets.instantiate('picture');
  secondPicture.scale.multiplyScalar(1 / METERS_PER_SIMULATION_UNIT);
  secondPicture.position.set(9, 10.8, -23.7);
  root.add(secondPicture);
  place('statue', [-11, 5.25, -20]);
  builder.add('cylinder', 'ceramic', [-5, 5.6, -18], [0.3, 0.65, 0.3]);
  builder.add(new THREE.TorusGeometry(0.23, 0.06, 6, 16), 'ceramic', [-4.65, 5.6, -18], [1, 1, 1]);
  builder.box('black', [13, 3.7, 8], [0.6, 0.1, 1.1]);
  builder.box('phone', [13, 3.76, 8], [0.55, 0.02, 1]);
  builder.tube(
    'black',
    [
      [13, 3.7, 8.7],
      [12, 3.7, 11],
      [11, 0.05, 12],
      [18, 0.05, 13],
    ],
    0.025,
  );
  for (let index = 0; index < 8; index++)
    builder.box(index % 2 ? 'cloth' : 'paper', [-11 + index * 0.35, 5.4, -19], [0.24, 0.3, 1.2]);
  for (const x of [8, 9.5]) builder.ball('sofa', [x, 0.16, 12], [0.4, 0.18, 0.9], solid);
  builder.box('black', [19.94, 9.8, 1], [0.08, 9, 13]);
  builder.box('glass', [19.8, 9.8, 1], [0.08, 8.7, 12.7]);
  for (const z of [-5.5, 1, 7.5]) builder.box('trim', [19.65, 9.8, z], [0.2, 9, 0.2]);
  for (const y of [5.3, 9.8, 14.3]) builder.box('trim', [19.65, y, 1], [0.2, 0.2, 13]);
  const curtain = new THREE.Group();
  root.add(curtain);
  const curtainMaterial = materials.sheet.clone();
  curtainMaterial.side = THREE.DoubleSide;
  for (const z of [-5.3, 7.2]) {
    const geometry = new THREE.PlaneGeometry(3.5, 13, 24, 12);
    const positions = geometry.attributes.position;
    for (let index = 0; index < positions.count; index++)
      positions.setZ(index, Math.sin(positions.getX(index) * 8) * 0.3);
    geometry.computeVertexNormals();
    builder.add(geometry, curtainMaterial, [19, 7.7, z], [1, 1, 1], {
      parent: curtain,
      rotation: [0, -Math.PI / 2, 0],
    });
  }
  const human = makeModelHuman(builder, assets, METERS_PER_SIMULATION_UNIT);
  builder.finish();
  scene.background = new THREE.Color(0x131c29);
  scene.fog = new THREE.FogExp2(0x182534, 0.07);
  scene.add(new THREE.HemisphereLight(0xbacfe8, 0x594537, 0.9));
  const moon = new THREE.DirectionalLight(0x9abef2, 2.2);
  moon.position.set(3, 4, 1);
  moon.target.position.set(-1, 0, -1);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -4, right: 4, top: 5, bottom: -5, near: 0.1, far: 12 });
  moon.shadow.normalBias = 0.005;
  scene.add(moon, moon.target);
  const lamp = new THREE.PointLight(0xffbe7b, 2.5, 5, 2);
  lamp.position.set(2.25, 0.85, 1.47);
  scene.add(lamp);
  const phone = new THREE.PointLight(0x87d5ff, 0.18, 1, 2);
  phone.position.set(1.95, 0.6, 1.2);
  scene.add(phone);
  const positions = new Float32Array(700 * 3);
  for (let index = 0; index < positions.length; index += 3) {
    positions[index] = Math.random() * 6 - 3;
    positions[index + 1] = Math.random() * 2.7;
    positions[index + 2] = Math.random() * 7.2 - 3.6;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: 0xc6d8ed,
      size: 0.004,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  scene.add(dust);
  const rayMaterial = new THREE.MeshBasicMaterial({
    color: 0x90b8ef,
    transparent: true,
    opacity: 0.025,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  for (let index = 0; index < 3; index++) {
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.5, 3.4, 12, 1, true), rayMaterial);
    ray.position.set(1.4, 1.1, -0.4 + index * 0.6);
    ray.rotation.z = -0.95;
    scene.add(ray);
  }
  return {
    root,
    builder,
    materials,
    human,
    lamp,
    moon,
    dust,
    models,
    bed,
    lampModel,
    solids: builder.solids,
    update(time, player, alert = 0) {
      human.update(time, player, alert);
      curtain.rotation.y = Math.sin(time * 0.8) * 0.02;
      dust.position.y = Math.sin(time * 0.1) * 0.02;
      builder.sync();
    },
    quality(level) {
      dustGeometry.setDrawRange(0, level === 'low' ? 200 : 700);
    },
  };
}
