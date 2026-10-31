import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read('public/models/sofa.glb');
const points = [];
for (const node of doc.getRoot().listNodes()) {
  if (!node.getMesh()) continue;
  const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix());
  for (const primitive of node.getMesh().listPrimitives()) {
    const p = primitive.getAttribute('POSITION');
    for (let i = 0; i < p.getCount(); i++) {
      const v = new THREE.Vector3().fromArray(p.getElement(i, [])).applyMatrix4(matrix);
      points.push(v);
    }
  }
}
for (let y = 0; y < 1.15; y += 0.1) {
  const selected = points.filter(p => p.y >= y && p.y < y + 0.1);
  const bounds = new THREE.Box3().setFromPoints(selected);
  console.log(y.toFixed(2), selected.length, bounds.min.toArray(), bounds.max.toArray());
}
for (const x of [-1.25, -0.9, 0, 0.9, 1.25]) {
  const selected = points.filter(p => Math.abs(p.x - x) < 0.08);
  console.log('x', x, new THREE.Box3().setFromPoints(selected));
}
