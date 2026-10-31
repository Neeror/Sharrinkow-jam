import fs from 'node:fs/promises';

const report = JSON.parse(await fs.readFile('artifacts/route-pilot.json', 'utf8'));
const frames = report.frames.filter((frame) => frame[1] > 0);
const summary = [];
for (let zone = 0; zone < 3; zone++) {
  const values = frames
    .filter(([route]) => (route < 5 ? 0 : route < 8 ? 1 : 2) === zone)
    .map((frame) => frame[1]);
  if (!values.length) continue;
  const sorted = values.toSorted((a, b) => a - b);
  let elapsed = 0;
  let count = 0;
  let minimumWindow = Infinity;
  for (const value of values) {
    elapsed += value;
    count++;
    if (elapsed >= 1000) {
      minimumWindow = Math.min(minimumWindow, (count * 1000) / elapsed);
      elapsed = 0;
      count = 0;
    }
  }
  summary.push({
    zone,
    frames: values.length,
    averageFps: (values.length * 1000) / values.reduce((a, b) => a + b, 0),
    minimumOneSecondFps: minimumWindow,
    p95Ms: sorted[Math.floor(sorted.length * 0.95)],
    p99Ms: sorted[Math.floor(sorted.length * 0.99)],
    maximumMs: sorted.at(-1),
    framesSlowerThan55: values.filter((value) => value > 1000 / 55).length,
  });
}
const trace = JSON.parse(await fs.readFile('artifacts/chrome-performance.json', 'utf8'));
const longTasks = trace.traceEvents.filter(
  (event) => event.name === 'RunTask' && event.dur > 50000,
);
const result = {
  browser: report.browser,
  phase: report.final.phase,
  seconds: report.final.time,
  quality: report.final.quality,
  zones: summary,
  longTasks: longTasks.length,
  errors: report.errors,
};
await fs.writeFile('artifacts/performance-summary.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
