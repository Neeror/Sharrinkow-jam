import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const url = process.argv[2];
assert.ok(url);
const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) console.log('HTTP', response.status(), response.url());
  });
  await page.goto(`${url}/models.html`);
  await page.waitForFunction(() => window.modelReview?.ready, null, { timeout: 90000 });
  for (const name of [
    'bed',
    'spider',
    'sofa',
    'desk',
    'shelves',
    'lamp',
    'picture',
    'statue',
    'human',
  ]) {
    await page.selectOption('#model', name);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `artifacts/model-${name}.png` });
  }
  const reports = await page.evaluate(() => window.modelReview.reports);
  console.log(JSON.stringify({ chrome: browser.version(), reports, errors }, null, 2));
  await writeFile(
    'artifacts/models-chrome.json',
    JSON.stringify({ chrome: browser.version(), reports, errors }, null, 2),
  );
  assert.deepEqual(errors, []);
  assert.ok(reports.bed.triangles >= 100000 && reports.bed.triangles <= 150000);
  assert.ok(Math.abs(reports.shelves.dimensions[1] - 2.1) < 0.001);
} finally {
  await browser.close();
}
