import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  await page.goto(`${process.argv[2]}/?debug`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Сцена укуса' }).click();
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    window.gameTest.ending.update = () => false;
  });
  await page.evaluate(() => {
    window.gameTest.world.bed.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.material = mesh.material.clone();
      mesh.material.map = null;
      mesh.material.normalMap = null;
      mesh.material.aoMap = null;
      mesh.material.bumpMap = null;
      mesh.receiveShadow = false;
      for (const key of Object.keys(mesh.material)) {
        if (mesh.material[key]?.isTexture) mesh.material[key] = null;
      }
      mesh.material.needsUpdate = true;
    });
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/bed-isolation-flat.png' });
  await page.evaluate(() => {
    window.gameTest.world.bed.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.material.flatShading = true;
      mesh.material.needsUpdate = true;
    });
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/bed-isolation-face-normals.png' });
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    window.gameTest.world.bed.traverse((mesh) => {
      if (mesh.isMesh)
        mesh.material = new THREE.MeshBasicMaterial({ color: 0xb0b0b0, side: THREE.DoubleSide });
    });
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/bed-isolation-basic.png' });
} finally {
  await browser.close();
}
