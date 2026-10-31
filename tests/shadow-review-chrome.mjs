import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  await page.goto(`${process.argv[2]}/?debug`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Сцена укуса' }).click();
  await page.waitForTimeout(2900);
  await page.evaluate(() => {
    const { ending } = window.gameTest;
    ending.update = () => false;
  });
  await page.screenshot({ path: 'artifacts/shadow-before.png' });
  await page.evaluate(() => {
    window.gameTest.world.moon.castShadow = false;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/shadow-disabled.png' });
  await page.evaluate(() => {
    const moon = window.gameTest.world.moon;
    moon.castShadow = true;
    moon.shadow.bias = -0.0003;
    moon.shadow.normalBias = 0.015;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/shadow-adjusted.png' });
  await page.evaluate(() => {
    const mesh = window.gameTest.world.bed.getObjectByName('cover_cover_top_0');
    mesh.material = mesh.material.clone();
    mesh.material.normalMap = null;
    mesh.material.bumpMap = null;
    mesh.material.aoMap = null;
    mesh.material.needsUpdate = true;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/bed-no-detail-maps.png' });
  await page.evaluate(() => {
    const mesh = window.gameTest.world.bed.getObjectByName('cover_cover_top_0');
    mesh.material.map = null;
    mesh.material.needsUpdate = true;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/bed-no-color-map.png' });
} finally {
  await browser.close();
}
