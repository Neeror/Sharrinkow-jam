import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { writeFileSync } from 'node:fs';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const report = [];
for (const file of process.argv.slice(2)) {
  const document = await io.read(file);
  const root = document.getRoot();
  let triangles = 0;
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      triangles += (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3;
    }
  }
  const entry = {
    file, triangles,
    textures: root.listTextures().map((texture) => ({ name: texture.getName(), size: texture.getSize(), mime: texture.getMimeType() })),
    animations: root.listAnimations().map((animation) => ({ name: animation.getName(), channels: animation.listChannels().map((channel) => ({ node: channel.getTargetNode().getName(), path: channel.getTargetPath() })) })),
    nodes: root.listNodes().filter((node) => node.getMesh()).map((node) => ({ name: node.getName(), matrix: node.getWorldMatrix(), bounds: node.getMesh().listPrimitives().map((primitive) => ({ min: primitive.getAttribute('POSITION').getMin([]), max: primitive.getAttribute('POSITION').getMax([]) })) })),
  };
  report.push(entry);
  console.log(JSON.stringify(entry));
}
writeFileSync('artifacts/gltf-inspection.json', JSON.stringify(report, null, 2));
