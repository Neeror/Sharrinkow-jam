import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: process.argv.includes('--headless'),
  args: [
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.text().includes('GL_INVALID'))
      errors.push(message.text());
  });
  await fs.mkdir('artifacts', { recursive: true });
  const localPillow = process.argv.includes('--local-pillow');
  const localArm = process.argv.includes('--local-arm');
  const audit = process.argv.includes('--audit');
  await page.goto(`${process.argv[2]}${localPillow || localArm || audit ? '/?test-controls' : ''}`);
  if (audit) {
    await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
    await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { player, world, game } = window.gameTest;
      const step = game.step.bind(game);
      const ray = new THREE.Ray();
      const direction = new THREE.Vector3(0.823, 0.371, 0.429).normalize();
      const local = new THREE.Vector3();
      const failures = [];
      let ticks = 0;
      window.routeAudit = {
        failures,
        get ticks() {
          return ticks;
        },
      };
      game.step = (...args) => {
        step(...args);
        ticks++;
        if (player.position.y < 0.159 && failures.length < 20)
          failures.push({ reason: 'floor', time: game.time, p: player.position.toArray() });
        for (const solid of world.solids) {
          local.copy(player.position).applyMatrix4(solid.inverse);
          let inside = false;
          if (solid.type === 'box')
            inside = Math.max(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z)) < 0.49999;
          else if (
            solid.type === 'mesh' &&
            solid.closed &&
            solid.geometry.boundingBox.containsPoint(local)
          ) {
            ray.set(local, direction);
            const hits = solid.geometry.boundsTree
              .raycast(ray, THREE.DoubleSide)
              .sort((a, b) => a.distance - b.distance);
            let count = 0;
            let last = -1;
            for (const hit of hits) {
              if (hit.distance < 0.00001 || hit.distance - last < 0.00001) continue;
              last = hit.distance;
              count++;
            }
            inside = count % 2 === 1;
          }
          if (inside && failures.length < 20)
            failures.push({
              reason: solid.name || solid.material,
              time: game.time,
              p: player.position.toArray(),
            });
        }
      };
    });
  }
  page.setDefaultTimeout(90000);
  await page.bringToFront();
  await page.waitForFunction(() => typeof window.gameDiagnostics === 'function');
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.waitForTimeout(500);
  if (localPillow) {
    await page.evaluate(() => {
      const { game, player, route } = window.gameTest;
      game.time = 153;
      game.debugRun = true;
      route.index = 7;
      route.target.fromArray(route.current.position);
      route.marker.position.copy(route.target);
      player.reset(route.target.clone().set(-0.99, 3.02, -3.85));
    });
  }
  if (localArm) {
    await page.evaluate(() => {
      const { game, player, route, enemies, threat } = window.gameTest;
      game.time = 200;
      game.debugRun = true;
      route.index = 8;
      route.target.fromArray(route.current.position);
      route.marker.position.copy(route.target);
      player.reset(route.target);
      enemies.update = () => {};
      threat.update = () => {};
    });
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Tracing.start', {
    categories: 'devtools.timeline,blink.user_timing,v8',
    transferMode: 'ReturnAsStream',
  });
  await page.exposeFunction('captureZone', async (zone) => {
    await page.screenshot({ path: `artifacts/zone-${zone}.png` });
  });
  const report = await page.evaluate(async () => {
    const sample = () => window.gameDiagnostics();
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const key = (code, down) =>
      window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    const aim = (yaw, pitch = 0.2) => {
      const state = sample();
      const delta = Math.atan2(Math.sin(yaw - state.yaw), Math.cos(yaw - state.yaw));
      document.dispatchEvent(
        new MouseEvent('mousemove', {
          buttons: 2,
          movementX: delta / 0.0027,
          movementY: (pitch - state.pitch) / 0.0027,
        }),
      );
    };
    const logs = [];
    const frames = [];
    let lastFrame = performance.now();
    let recording = true;
    let activeRoute = 0;
    function record(now) {
      if (!recording) return;
      frames.push([activeRoute, now - lastFrame]);
      lastFrame = now;
      requestAnimationFrame(record);
    }
    requestAnimationFrame(record);
    const detours = {
      1: [
        [-8.8, 0.16, -4.7],
        [-14.9, 0.16, -5.7],
      ],
      2: [
        [-14.2, 0.16, -5],
        [-13.3667, 0.162, -15],
        [-13.3667, 5.4067, -16.05],
      ],
      3: [
        [-0.8, 0.16, -18],
        [-0.8, 0.16, -21.9],
        [11.7, 0.16, -21.9],
        [11.7, 0.16, -11.5],
      ],
      4: [
        [18, 0.16, 9],
        [16.9, 0.16, 9],
        [16.6, 4, 9],
      ],
      5: [
        [10.8, 3.76, 8],
        [10.8, 0.16, 5.7],
        [6, 0.16, 5.8],
        [6, 2.37, 1.7],
      ],
      6: [[2, 3.55, -4.5]],
      7: [
        [2, 3.55, -4.5],
        [2, 4.2, -9.2],
        [2, 5.05, -11],
      ],
    };
    if (window.gameTest) {
      const THREE = await import('/node_modules/three/build/three.module.js');
      for (const point of detours[7]) {
        const hit = window.gameTest.player.collision.cast(
          new THREE.Vector3(point[0], 9, point[2]),
          new THREE.Vector3(0, -1, 0),
          10,
        );
        if (hit) point[1] = hit.point.y + 0.162;
      }
    }
    let lastRoute = -1;
    let progressTime = sample().time;
    let detourIndex = 0;
    let stuck = 0;
    let previous = sample().position;
    for (let iteration = 0; iteration < 2400; iteration++) {
      const state = sample();
      if (state.phase === 'ending') {
        key('KeyW', false);
        key('KeyE', false);
        await delay(9500);
        break;
      }
      if (state.phase !== 'playing' || state.time - progressTime > 40) break;
      if (state.route !== lastRoute) {
        lastRoute = state.route;
        activeRoute = state.route;
        progressTime = state.time;
        detourIndex = 0;
        logs.push({
          route: state.route,
          time: state.time,
          position: state.position,
          fps: state.fps,
          quality: state.quality,
        });
        if ([1, 6, 9].includes(state.route)) await window.captureZone(state.route);
      }
      const detour = detours[state.route]?.[detourIndex];
      const danger =
        state.swatter > 0 ? state.swatTarget : state.warning > 0 ? state.handTarget : null;
      const dodge =
        danger && Math.hypot(state.position[0] - danger[0], state.position[2] - danger[2]) < 2.1;
      const target = dodge
        ? [danger[0] + 3.8, state.position[1], danger[2]]
        : detour || state.target;
      const dx = target[0] - state.position[0];
      const dy = target[1] - state.position[1];
      const dz = target[2] - state.position[2];
      if (!dodge && detour && Math.hypot(dx, dz) < 0.45 && Math.abs(dy) < 0.45) {
        detourIndex++;
        progressTime = state.time;
      }
      const close =
        !detour && Math.hypot(dx, dy, dz) < 0.85 && Math.abs(dy) < 0.4 && state.normal[1] > 0.45;
      const lampStop =
        state.lamp &&
        Math.hypot(state.position[0] - 14, state.position[2] - 9) < 5.5 &&
        state.position[1] > 2.8;
      let vertical = close || lampStop ? 0 : 1;
      let yaw = Math.atan2(dx, -dz);
      if (
        (Math.abs(state.normal[1]) < 0.1 || (state.material === 'skin' && state.normal[1] < 0.5)) &&
        Math.abs(dy) > 0.05
      ) {
        yaw = Math.atan2(-state.normal[0], state.normal[2]);
        vertical = dy > 0 ? 1 : -1;
      }
      if (state.route === 2 && detourIndex === 2 && state.position[1] < 5.4) {
        yaw = 0;
        vertical = 1;
      }
      const reelUp = (!detour || state.route === 7) && dy > 0.8 && Math.hypot(dx, dz) < 3;
      if (reelUp || dodge) vertical = 1;
      let pitch =
        state.route === 7
          ? -0.35
          : reelUp
            ? -Math.atan2(dy, Math.max(0.1, Math.hypot(dx, dz)))
            : 0.2;
      if (state.material === 'skin' && !reelUp && !close) {
        const THREE = await import('/node_modules/three/build/three.module.js');
        const normal = new THREE.Vector3(...state.normal);
        const goal = new THREE.Vector3(dx, dy, dz);
        goal.addScaledVector(normal, -goal.dot(normal)).normalize();
        const right = new THREE.Vector3();
        const forward = new THREE.Vector3();
        const travel = new THREE.Vector3();
        let best = -Infinity;
        for (let index = 0; index < 72; index++) {
          const angle = (index * Math.PI * 2) / 72;
          forward.set(
            Math.sin(angle) * Math.cos(pitch),
            -Math.sin(pitch),
            -Math.cos(angle) * Math.cos(pitch),
          );
          const incidence = forward.dot(normal);
          right.set(Math.cos(angle), 0, Math.sin(angle));
          right.addScaledVector(normal, -right.dot(normal)).normalize();
          forward.addScaledVector(normal, -incidence);
          travel.crossVectors(normal, right).normalize();
          if (normal.y < -0.01 || (Math.abs(normal.y) < 0.01 && incidence > 0)) travel.negate();
          if (forward.lengthSq() > 0.0025) forward.normalize();
          else forward.copy(travel);
          forward
            .lerp(travel, THREE.MathUtils.smoothstep(Math.abs(incidence), 0.5, 0.85))
            .normalize();
          const score = Math.abs(forward.dot(goal));
          if (score > best) {
            best = score;
            yaw = angle;
            vertical = forward.dot(goal) >= 0 ? 1 : -1;
          }
        }
      }
      const quietPause = !dodge && state.route >= 6 && state.noise > 0.18;
      if (quietPause) {
        vertical = 0;
        progressTime = state.time;
      }
      aim(yaw, pitch);
      key('ShiftLeft', Boolean(dodge));
      key('KeyE', reelUp && !dodge && !quietPause);
      key('KeyW', vertical > 0);
      key('KeyS', vertical < 0);
      key(
        'ControlLeft',
        !dodge && state.normal[1] > 0.45 && (state.route >= 6 || state.noise > 0.2),
      );
      key('KeyQ', dy < -0.8 && state.route < 6 && state.route !== 2);
      const moved = Math.hypot(...state.position.map((n, i) => n - previous[i]));
      stuck = moved < 0.02 && vertical !== 0 ? stuck + 1 : 0;
      if (
        !quietPause &&
        state.noise < 0.12 &&
        (stuck > 12 || (dy < -1 && state.normal[1] < -0.5))
      ) {
        key('Space', true);
        key('Space', false);
        stuck = 0;
      }
      previous = state.position;
      if (iteration % 100 === 0)
        logs.push({
          iteration,
          route: state.route,
          detourIndex,
          position: state.position,
          normal: state.normal,
          time: state.time,
          noise: state.noise,
        });
      await delay(150);
    }
    key('KeyW', false);
    key('KeyS', false);
    key('ControlLeft', false);
    recording = false;
    return { logs, frames, final: sample() };
  });
  const tracingDone = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  const { stream } = await tracingDone;
  const traceFile = await fs.open(
    localPillow ? 'artifacts/pillow-local-trace.json' : 'artifacts/chrome-performance.json',
    'w',
  );
  while (true) {
    const chunk = await cdp.send('IO.read', { handle: stream });
    await traceFile.write(chunk.data);
    if (chunk.eof) break;
  }
  await traceFile.close();
  await cdp.send('IO.close', { handle: stream });
  report.metrics = await cdp.send('Performance.getMetrics');
  report.errors = errors;
  report.browser = browser.version();
  report.teleported = localPillow || localArm;
  if (audit) {
    report.audit = await page.evaluate(() => ({
      ticks: window.routeAudit.ticks,
      failures: window.routeAudit.failures,
    }));
    await fs.writeFile(
      localArm ? 'artifacts/arm-local-audit.json' : 'artifacts/route-audit.json',
      JSON.stringify(report.audit, null, 2),
    );
    assert.deepEqual(report.audit.failures, [], 'no penetration on any audited physics step');
  }
  await fs.writeFile(
    localArm
      ? 'artifacts/arm-local.json'
      : localPillow
        ? 'artifacts/pillow-local.json'
        : 'artifacts/route-pilot.json',
    JSON.stringify(report, null, 2),
  );
  await page.screenshot({
    path: localPillow ? 'artifacts/pillow-local.png' : 'artifacts/route-pilot.png',
  });
  console.log(
    JSON.stringify({
      logs: report.logs,
      final: {
        phase: report.final.phase,
        route: report.final.route,
        time: report.final.time,
        reason: report.final.reason,
        position: report.final.position,
      },
      errors,
    }),
  );
  assert.equal(report.final.phase, 'won', 'complete room route through keyboard and mouse');
  if (!localPillow) assert.ok(report.final.time >= 180 && report.final.time <= 300);
  assert.equal(report.final.quality, 'high');
  assert.deepEqual(errors, []);
  if (!localPillow && !localArm)
    assert.ok(await page.evaluate(() => Number(localStorage.getItem('ruka-cela-room-best')) > 0));
  await page.getByRole('button', { name: 'Ещё одна ночь' }).click();
  assert.equal((await page.evaluate(() => window.gameDiagnostics())).phase, 'playing');
  console.log(
    localArm
      ? 'PASS isolated arm traversal with teleport and threats disabled; victory and restart; not a full playthrough'
      : localPillow
        ? 'PASS isolated pillow traversal with teleport; victory and restart; not a full playthrough'
        : 'PASS full route, victory, persisted best, restart, high quality unchanged',
  );
} finally {
  await browser.close();
}
