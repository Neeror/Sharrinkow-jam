import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: process.argv.includes('--headless'),
  args: ['--disable-backgrounding-occluded-windows'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'debug') errors.push(`${message.type()}: ${message.text()}`);
  });
  const system = await browser.newBrowserCDPSession();
  const gpu = await system.send('SystemInfo.getInfo');
  console.log('GPU', gpu.gpu.auxAttributes.glRenderer);
  await page.goto(process.argv[2]);
  await page.bringToFront();
  await page.waitForFunction(() => typeof window.gameDiagnostics === 'function');
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.locator('#scene').click({ position: { x: 680, y: 380 } });
  await page.waitForFunction(() => window.gameDiagnostics().locked);
  await page.waitForTimeout(2000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.evaluate(() => {
    window.frameProbe = [];
    let last = performance.now();
    function record(now) {
      window.frameProbe.push(now - last);
      last = now;
      if (window.frameProbe.length < 3000) requestAnimationFrame(record);
    }
    requestAnimationFrame(record);
  });
  await page.waitForTimeout(8000);
  console.log(
    'STATE',
    JSON.stringify(
      await page.evaluate(() => ({
        state: window.gameDiagnostics(),
        visibility: document.visibilityState,
        focus: document.hasFocus(),
        samples: window.frameProbe.slice(0, 30),
        count: window.frameProbe.length,
      })),
    ),
  );
  console.log('METRICS', JSON.stringify(await cdp.send('Performance.getMetrics')));
  console.log('CONSOLE', JSON.stringify(errors.slice(0, 20)));
  await fs.mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/performance-probe.png' });
} finally {
  await browser.close();
}
