import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'public/models');
mkdirSync(output, { recursive: true });
const extracted = path.join(root, 'source-models/extracted');
const jobs = [
  ['bed', 'source-models/prepared/bed.glb', 2048, null],
  ['spider', 'source-models/black_widow_spider.glb', 1024, null],
];
for (const [prefix, name] of [
  ['sofa_03', 'sofa'],
  ['metal_office_desk', 'desk'],
  ['steel_frame_shelves_01', 'shelves'],
  ['industrial_pipe_lamp', 'lamp'],
  ['hanging_picture_frame_02', 'picture'],
  ['bronze_shark_statue', 'statue'],
]) {
  const folder = readdirSync(extracted).find((entry) => entry.startsWith(prefix));
  const directory = path.join(extracted, folder);
  const file = readdirSync(directory).find((entry) => entry.endsWith('.gltf'));
  jobs.push([name, path.join(directory, file), name === 'sofa' ? 2048 : 1024, null]);
}
const report = [];
for (const [name, input, size, ratio] of jobs) {
  const destination = path.join(output, `${name}.glb`);
  const args = [
    'node_modules/@gltf-transform/cli/bin/cli.js',
    'optimize', input, destination,
    '--compress', 'meshopt',
    '--texture-compress', 'false',
    '--texture-size', String(size),
    '--simplify', ratio ? 'true' : 'false',
    '--flatten', name === 'spider' ? 'false' : 'true',
    '--join', name === 'spider' ? 'false' : 'true',
  ];
  if (ratio) args.push('--simplify-ratio', String(ratio), '--simplify-error', '0.05');
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  console.log(name, result.stdout, result.stderr);
  if (result.status !== 0) throw new Error(`Asset conversion failed: ${name}`);
  report.push({ name, path: destination, bytes: statSync(destination).size });
  writeFileSync('artifacts/prepared-models.json', JSON.stringify(report, null, 2));
}
console.log('TOTAL_BYTES', report.reduce((sum, entry) => sum + entry.bytes, 0));
