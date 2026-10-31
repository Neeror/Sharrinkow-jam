import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  await page.goto(`${process.argv[2]}/?debug`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  console.log(
    JSON.stringify(
      await page.evaluate(async () => {
        const THREE = await import('/node_modules/three/build/three.module.js');
        const { world } = window.gameTest;
        const meshes = [];
        world.bed.traverse((mesh) => {
          if (!mesh.isMesh) return;
          const bounds = new THREE.Box3().setFromObject(mesh);
          meshes.push({
            name: mesh.name,
            material: mesh.material.name,
            bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
            color: mesh.material.color.toArray(),
          });
        });
        return meshes;
      }),
      null,
      2,
    ),
  );
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Сцена укуса' }).click();
  await page.waitForTimeout(2900);
  await page.evaluate(() => {
    window.gameTest.ending.update = () => false;
  });
  await page.evaluate(() => {
    window.gameTest.world.bed.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.material = mesh.material.clone();
      mesh.material.polygonOffset = true;
      mesh.material.polygonOffsetFactor = 1;
      mesh.material.polygonOffsetUnits = 1;
    });
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/bed-offset.png' });
  for (const name of ['cover_cover_bottom_0', 'cover_cover_top_0', 'sheet_sheet_0']) {
    await page.evaluate((name) => {
      const object = window.gameTest.world.bed.getObjectByName(name);
      object.visible = false;
    }, name);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `artifacts/bed-without-${name}.png` });
    await page.evaluate((name) => {
      window.gameTest.world.bed.getObjectByName(name).visible = true;
    }, name);
  }
} finally {
  await browser.close();
}
