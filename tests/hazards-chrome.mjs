import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.argv[2]);
  await page.waitForFunction(() => typeof window.gameDiagnostics === 'function');
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'artifacts/stage-5.png' });
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { makeWorld } = await import('/src/world.js');
    const { Enemies } = await import('/src/enemies.js');
    const { Route } = await import('/src/route.js');
    const world = makeWorld(new THREE.Scene());
    const enemies = new Enemies(world);
    const player = {
      position: new THREE.Vector3(-13, 0.16, -3),
      speed: 0,
      slow: 0,
      normal: new THREE.Vector3(0, 1, 0),
    };
    const threat = { noise: 0, awake: 0, shake: 0 };
    for (let i = 0; i < 360; i++) enemies.update(1 / 120, 3, player, threat, 0, false);
    const tape = enemies.reason;
    enemies.reset();
    player.position.set(-4, 0.16, 6);
    enemies.update(1 / 120, 3, player, threat, 0, false);
    const trap = enemies.reason;
    enemies.reset();
    player.position.set(3, 0.16, 15);
    enemies.catGrace = 0;
    enemies.update(1 / 120, 3, player, threat, 0, false);
    const cat = enemies.reason;
    enemies.reset();
    player.position.set(14, 4, 9);
    player.speed = 1;
    for (let i = 0; i < 380; i++) enemies.update(1 / 120, 17, player, threat, 0, false);
    const lamp = enemies.reason;
    enemies.reset();
    player.position.set(-6, 5, -15);
    enemies.update(1 / 120, 3, player, threat, 0, true);
    const fan = enemies.wind.z;
    player.position.set(17, 5, 0);
    enemies.update(1 / 120, 3, player, threat, 0, true);
    const draft = enemies.wind.x;
    enemies.reset();
    player.position.set(5, 4, -2);
    threat.noise = 0.5;
    enemies.swatCooldown = 0;
    for (let i = 0; i < 175; i++) enemies.update(1 / 120, 3, player, threat, 1, false);
    const swatter = enemies.reason;
    const route = new Route(world.builder.scene);
    player.speed = 0;
    let checkpoint = 0;
    for (let index = 0; index < 12; index++) {
      player.position.copy(route.target);
      for (let i = 0; i < 970 && route.index === index; i++) route.update(1 / 120, player);
      checkpoint = Math.max(checkpoint, route.checkpoint);
    }
    const won = route.completed;
    route.restart(false);
    return { tape, trap, cat, lamp, fan, draft, swatter, won, checkpoint, restarted: route.index };
  });
  for (const name of ['tape', 'trap', 'cat', 'lamp', 'swatter']) assert.ok(result[name], name);
  assert.ok(result.fan > 0);
  assert.ok(result.draft < 0);
  assert.equal(result.won, true);
  assert.equal(result.checkpoint, 8);
  assert.equal(result.restarted, 8);
  assert.deepEqual(errors, []);
  console.log('PASS Chrome: actual hazard and route modules, all branches', result);
} finally {
  await browser.close();
}
