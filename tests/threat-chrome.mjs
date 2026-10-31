import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const page = await browser.newPage();
  await page.goto(process.argv[2]);
  await page.waitForFunction(() => typeof window.gameDiagnostics === 'function');
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { HumanThreat } = await import('/src/threat.js');
    const scene = new THREE.Scene();
    const threat = new HumanThreat(scene, new THREE.MeshStandardMaterial());
    const player = { position: new THREE.Vector3(5, 4, -3), speed: 2, noise: 0.02 };
    threat.cooldown = 0;
    for (let i = 0; i < 34; i++) threat.update(1 / 120, player, i / 120, 1);
    const warned = threat.warning > 0 && threat.shadow.visible && threat.hand.visible;
    const remaining = threat.warning;
    player.noise = 0;
    for (let i = 0; i < 125; i++) threat.update(1 / 120, player, 1 + i / 120, 1);
    const hit = Boolean(threat.reason);
    threat.reset();
    threat.cooldown = 0;
    threat.warn(player);
    const fullWarning = threat.warning;
    player.position.x += 4;
    for (let i = 0; i < 125; i++) threat.update(1 / 120, player, 3 + i / 120, 2);
    return {
      warned,
      remaining,
      hit,
      fullWarning,
      dodges: threat.dodges,
      slow: threat.slow,
      reason: threat.reason,
    };
  });
  assert.equal(result.warned, true);
  assert.equal(result.fullWarning, 1);
  assert.equal(result.hit, true);
  assert.equal(result.dodges, 1);
  assert.ok(result.slow > 0);
  assert.equal(result.reason, '');
  console.log(
    'PASS Chrome: real threat module, shadow, 1 second warning, impact and dodge',
    result,
  );
} finally {
  await browser.close();
}
