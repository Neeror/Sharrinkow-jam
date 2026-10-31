import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { getBounds } from '@gltf-transform/core';

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const round = (values) => values.map((value) => Number(value.toFixed(3)));

for (const name of process.argv.slice(2)) {
  const document = await io.read(`public/models/${name}.glb`);
  const scene = document.getRoot().getDefaultScene() || document.getRoot().listScenes()[0];
  const total = getBounds(scene);
  console.log(name, 'scene', round(total.min), round(total.max));
  for (const node of document.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    const bounds = getBounds(node);
    let triangles = 0;
    for (const primitive of node.getMesh().listPrimitives()) {
      const indices = primitive.getIndices();
      triangles += (indices ? indices.getCount() : primitive.getAttribute('POSITION').getCount()) / 3;
    }
    console.log(' ', node.getName(), triangles, round(bounds.min), round(bounds.max));
  }
}
