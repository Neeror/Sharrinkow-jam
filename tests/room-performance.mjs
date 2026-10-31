import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--disable-backgrounding-occluded-windows'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.bringToFront();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const result = await page.evaluate(async () => {
    const { player, input, follow, game } = window.gameTest;
    const runs = [];
    for (const position of [
      [-7, 0.162, 21],
      [-15.4, 0.162, 6],
      [4, 6, -4],
    ]) {
      player.reset(player.position.clone().fromArray(position));
      follow.ready = false;
      const frames = [];
      let last = performance.now();
      await new Promise((resolve) => {
        setTimeout(resolve, 6000);
        function frame(now) {
          frames.push(now - last);
          last = now;
          if (frames.length < 240) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
      const sorted = frames.slice(10).sort((a, b) => a - b);
      runs.push({
        position,
        meanFps: 1000 / (sorted.reduce((a, b) => a + b, 0) / sorted.length),
        p95: sorted[Math.floor(sorted.length * 0.95)],
        max: sorted.at(-1),
        count: sorted.length,
        visibility: document.visibilityState,
        focus: document.hasFocus(),
        state: window.gameDiagnostics(false),
      });
    }
    return runs;
  });
  const metrics = await cdp.send('Performance.getMetrics');
  await fs.writeFile(
    'artifacts/room-performance.json',
    JSON.stringify({ result, metrics }, null, 2),
  );
  console.log(
    JSON.stringify(
      result.map((r) => ({
        position: r.position,
        fps: r.meanFps,
        p95: r.p95,
        max: r.max,
        count: r.count,
        visibility: r.visibility,
        focus: r.focus,
        calls: r.state.drawCalls,
        triangles: r.state.triangles,
        phase: r.state.phase,
      })),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
