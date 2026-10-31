import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  await page.evaluate(() => {
    const { game, follow, camera, player } = window.gameTest;
    game.setPhase('paused');
    follow.update = () => {};
    camera.position.set(15, 14, 1);
    camera.lookAt(5.8, 4.3, -7);
  });
  for (const light of ['moon', 'lamp']) {
    await page.evaluate((light) => {
      const { world } = window.gameTest;
      world.moon.intensity = light === 'moon' ? 2.2 : 0.3;
      world.lamp.intensity = light === 'lamp' ? 4 : 0;
      world.lamp.position.set(1.3, 1.3, -0.7);
      document.querySelectorAll('.panel').forEach((n) => n.classList.add('hidden'));
    }, light);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `artifacts/human-${light}-review.png` });
  }
  console.log('Chrome human light review captured');
} finally {
  await browser.close();
}
