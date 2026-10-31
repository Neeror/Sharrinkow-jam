import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  const locations = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { world, game, follow, collisionDebug } = window.gameTest;
    game.setPhase('paused');
    follow.update = () => {};
    collisionDebug.group.visible = false;
    document
      .querySelectorAll('.panel, header, footer, #hud, #crosshair')
      .forEach((node) => (node.style.display = 'none'));
    const definitions = [
      ['heel', /DEF-footR$/],
      ['knee', /DEF-shinR$/],
      ['torso', /DEF-spine002$/],
      ['arm', /DEF-forearmR001$/],
    ];
    const result = [];
    for (const [name, pattern] of definitions) {
      const joint = [...world.human.joints].find(([key]) => pattern.test(key));
      if (joint) result.push({ name, bone: joint[0], position: joint[1].toArray() });
      else result.push({ name, missing: true });
    }
    result.push(
      { name: 'pillow', position: [2, 4.8, -11.5] },
      { name: 'blanket', position: [5.5, 4.5, -1] },
      { name: 'bed-frame', position: [-1, 1, -4] },
    );
    return result;
  });
  for (const location of locations) {
    if (location.missing) continue;
    await page.evaluate(async (location) => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { camera, world } = window.gameTest;
      const target = new THREE.Vector3(...location.position);
      camera.position.copy(target).add(new THREE.Vector3(-2.4, 2.7, 3));
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      for (const anchor of window.gameTest.thread.anchors) {
        anchor.marker.visible = false;
        anchor.stalk.visible = false;
      }
    }, location);
    await page.waitForTimeout(180);
    await page.screenshot({ path: `artifacts/surface-${location.name}.png` });
  }
  await fs.writeFile(
    'artifacts/surface-screenshots.json',
    JSON.stringify({ locations, errors }, null, 2),
  );
  console.log(JSON.stringify({ locations, errors }, null, 2));
} finally {
  await browser.close();
}
