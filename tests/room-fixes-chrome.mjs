import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.locator('#scene').click({ position: { x: 680, y: 380 } });
  const report = await page.evaluate(async () => {
    const { player, input, thread, world, follow, game } = window.gameTest;
    const THREE = await import('/node_modules/three/build/three.module.js');
    const dt = 1 / 120;
    const runs = [];
    const drive = (start, yaw, seconds, extra = {}) => {
      player.reset(new THREE.Vector3(...start));
      const controls = { yaw, pitch: 0.15, vertical: 1, horizontal: 0, ...extra };
      const samples = [];
      for (let i = 0; i < seconds * 120; i++) {
        player.step(dt, controls);
        if (i % 120 === 0)
          samples.push({ p: player.position.toArray(), n: player.normal.toArray() });
      }
      runs.push({
        start,
        yaw,
        samples,
        end: player.position.toArray(),
        normal: player.normal.toArray(),
        velocity: player.velocity.toArray(),
        rappelling: player.rappelling,
        cooldown: player.jumpCooldown,
      });
      return player.position.toArray();
    };
    drive([-11.2, 0.162, 6], -Math.PI / 2, 4);
    drive([-11.2, 0.162, 14.8], Math.PI, 9);
    drive([-12.5, 0.162, -15], 0, 8);
    drive([13, 0.162, -12], Math.PI / 2, 3);
    const edges = [];
    for (const [start, yaw] of [
      [[4, 6, 2], Math.PI],
      [[-1, 6, -5], -Math.PI / 2],
      [[8, 6, -5], Math.PI / 2],
      [[4, 6, -12], 0],
    ]) {
      const down = new THREE.Vector3(0, -1, 0);
      const hit = player.collision.cast(new THREE.Vector3(...start), down, 10);
      if (!hit) continue;
      const p = hit.point.clone().addScaledVector(hit.normal, 0.162);
      drive(p.toArray(), yaw, 12, { descend: true });
      edges.push(runs.at(-1));
    }
    const boxers = [];
    world.human.root.traverse((o) => {
      if (o.isMesh && /boxer/i.test(o.material.name))
        boxers.push({
          name: o.material.name,
          color: o.material.color.toArray(),
          roughness: o.material.roughness,
          map: o.material.map?.colorSpace,
        });
    });
    player.reset(new THREE.Vector3(4, 7, -4));
    input.yaw = 0;
    input.pitch = 0.6;
    follow.ready = false;
    return {
      runs,
      edges,
      boxers,
      triangles: window.gameDiagnostics().triangles,
      calls: window.gameDiagnostics().drawCalls,
    };
  });
  console.log(
    JSON.stringify(
      {
        runs: report.runs.map((r) => ({
          start: r.start,
          end: r.end,
          normal: r.normal,
          velocity: r.velocity,
          rappelling: r.rappelling,
          cooldown: r.cooldown,
        })),
        boxers: report.boxers,
        triangles: report.triangles,
        calls: report.calls,
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    'artifacts/room-fixes-chrome.json',
    JSON.stringify({ report, errors }, null, 2),
  );
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'artifacts/human-covered.png' });
  await page.keyboard.press('F3');
  await page.screenshot({ path: 'artifacts/room-fixes-debug.png' });
  assert.ok(report.runs[0].end[0] < -17, 'under-sofa crossing');
  assert.ok(
    report.boxers.length > 0 && report.boxers.every((m) => Math.max(...m.color) < 0.1),
    'dark boxer material',
  );
  assert.ok(
    report.runs.every((r) => r.samples.every((s) => s.p[1] >= 0.15)),
    'no floor penetration',
  );
  assert.deepEqual(errors, []);
  assert.equal(report.edges.length, 4, 'all four bed edges were exercised');
  assert.ok(
    report.edges.slice(0, 3).every((r) => r.samples.some((s) => s.p[1] < 0.3)),
    'three open bed edges reach the floor',
  );
  assert.ok(
    report.edges[3].samples.some((s) => s.p[1] < 0.3),
    'headboard descent reaches the floor',
  );
  console.log('PASS Chrome local collision, material and all bed-edge regressions');
} finally {
  await browser.close();
}
