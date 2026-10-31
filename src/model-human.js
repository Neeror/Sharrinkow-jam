import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bakeCollisionGeometry } from './collision-geometry.js';
import { makeSleepingCover } from './sleeping-cover.js';
import { buildShellCollider } from './colliders.js';

export function makeModelHuman(builder, assets, metersPerUnit) {
  const root = builder.scene;
  const model = assets.instantiate('human');
  model.scale.multiplyScalar(1 / metersPerUnit);
  model.rotation.y = 0;
  model.position.set(5.6, 3.3, -6.2);
  root.add(model);
  root.updateMatrixWorld(true);
  makeSleepingCover(builder, model);
  const inverseRoot = root.matrixWorld.clone().invert();
  const transform = new THREE.Matrix4();
  const vertex = new THREE.Vector3();
  const geometries = [];
  const joints = new Map();
  model.traverse((object) => {
    if (object.isBone) {
      object.getWorldPosition(vertex).applyMatrix4(inverseRoot);
      joints.set(object.name, vertex.clone());
    }
    if (!object.isMesh || !/^(Body|Boxers)/.test(object.name)) return;
    transform.multiplyMatrices(inverseRoot, object.matrixWorld);
    geometries.push(bakeCollisionGeometry(object, transform));
  });
  const detailed = mergeGeometries(geometries);
  detailed.boundsTree = new MeshBVH(detailed, { maxLeafTris: 12 });
  const geometry = buildShellCollider(detailed, 0.12);
  detailed.dispose();
  const collider = new THREE.Object3D();
  root.add(collider);
  builder.solids.push({
    type: 'mesh',
    name: 'human',
    closed: true,
    geometry,
    mesh: collider,
    inverse: new THREE.Matrix4(),
    material: 'skin',
    moving: true,
  });
  for (const part of geometries) part.dispose();
  builder.objects.push('Спящий человек');
  return {
    root: model,
    joints,
    hair: { count: 0 },
    update(time, player, alert = 0) {
      const breathing = Math.sin(time * 1.3) * 0.04;
      const turn = Math.sin(time * 0.27) * alert * 0.08;
      model.position.y = 3.3 + breathing;
      model.position.x = 5.6 + turn;
      collider.position.set(turn, breathing, 0);
    },
  };
}
