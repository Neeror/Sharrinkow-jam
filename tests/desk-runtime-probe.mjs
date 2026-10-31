import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const page = await browser.newPage();
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest);
  console.log(
    await page.evaluate(() => {
      const { player } = window.gameTest;
      const results = [];
      for (const x of [-0.73, 0.73]) {
        player.reset(player.position.clone().set(-8.5 + x / 0.15, 0.162, -15));
        let max = 0;
        for (let i = 0; i < 1800; i++) {
          player.step(1 / 120, { yaw: 0, pitch: 0.15, vertical: 1, horizontal: 0 });
          max = Math.max(max, player.position.y);
          if (max > 5.4) break;
        }
        results.push({ x, max, p: player.position.toArray(), n: player.normal.toArray() });
      }
      return results;
    }),
  );
} finally {
  await browser.close();
}
