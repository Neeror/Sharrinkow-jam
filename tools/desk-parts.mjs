import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read('public/models/desk.glb');
for (const mesh of doc.getRoot().listMeshes()) {
  for (const p of mesh.listPrimitives()) {
    console.log(p.getMaterial()?.getName(), p.getAttribute('POSITION').getCount(), p.getAttribute('POSITION').getMin([]), p.getAttribute('POSITION').getMax([]));
  }
}
