import fs from 'node:fs/promises';
const report = [];
for (const path of ['artifacts/route-pass-1.json', 'artifacts/route-pass-2.json']) {
  const data = JSON.parse(await fs.readFile(path, 'utf8'));
  const samples = data.frames.map((entry) => entry[1]).filter((value) => value > 0);
  const sorted = [...samples].sort((a, b) => a - b);
  const groups = [];
  let duration = 0;
  let count = 0;
  for (const delta of samples) {
    duration += delta;
    count++;
    if (duration >= 1000) {
      groups.push((count * 1000) / duration);
      duration = 0;
      count = 0;
    }
  }
  report.push({
    path,
    phase: data.final.phase,
    time: data.final.time,
    errors: data.errors,
    frames: samples.length,
    averageFps: (samples.length * 1000) / samples.reduce((sum, value) => sum + value, 0),
    minimumOneSecondFps: Math.min(...groups),
    p99FrameMs: sorted[Math.floor(sorted.length * 0.99)],
    longestFrameMs: Math.max(...samples),
    framesSlowerThan55: samples.filter((value) => value > 1000 / 55).length,
  });
}
await fs.writeFile('artifacts/current-performance-summary.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
