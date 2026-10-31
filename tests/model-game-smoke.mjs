import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: process.argv.includes('--headless'),
});
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.argv[2]);
  await page.waitForFunction(() => window.gameDiagnostics, null, { timeout: 90000 });
  await page.screenshot({ path: 'artifacts/model-room.png' });
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'artifacts/model-start.png' });
  await page.keyboard.down('s');
  await page.waitForTimeout(4000);
  await page.keyboard.up('s');
  await page.screenshot({ path: 'artifacts/model-wall.png' });
  console.log(
    JSON.stringify({ state: await page.evaluate(() => window.gameDiagnostics(false)), errors }),
  );
  await writeFile(
    'artifacts/model-smoke.json',
    JSON.stringify(
      { state: await page.evaluate(() => window.gameDiagnostics(false)), errors },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
