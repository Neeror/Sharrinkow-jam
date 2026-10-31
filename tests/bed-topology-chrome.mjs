import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  await page.goto(`${process.argv[2]}/?debug`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  const report = await page.evaluate(() => {
    const meshes = [];
    window.gameTest.world.bed.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const p = mesh.geometry.attributes.position;
      const index = mesh.geometry.index;
      const seen = new Set();
      let duplicates = 0;
      const total = index ? index.count : p.count;
      for (let i = 0; i < total; i += 3) {
        const corners = [];
        for (let k = 0; k < 3; k++) {
          const vertex = index ? index.getX(i + k) : i + k;
          corners.push(
            [p.getX(vertex), p.getY(vertex), p.getZ(vertex)].map((n) => n.toFixed(6)).join(','),
          );
        }
        const key = corners.sort().join('|');
        if (seen.has(key)) duplicates++;
        seen.add(key);
      }
      meshes.push({
        name: mesh.name,
        triangles: total / 3,
        duplicates,
        materialSide: mesh.material.side,
        transparent: mesh.material.transparent,
      });
    });
    return meshes;
  });
  console.log(JSON.stringify(report, null, 2));
  await fs.writeFile('artifacts/bed-topology.json', JSON.stringify(report, null, 2));
  await page.getByRole('button', { name: 'Начать ночь' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Сцена укуса' }).click();
  await page.waitForTimeout(2900);
  await page.evaluate(() => {
    window.gameTest.ending.update = () => false;
  });
  await page.screenshot({ path: 'artifacts/bed-clean-before.png' });
  await page.evaluate(() => {
    const mesh = window.gameTest.world.bed.getObjectByName('cover_cover_top_0');
    mesh.material = mesh.material.clone();
    mesh.material.side = 0;
    mesh.material.needsUpdate = true;
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/bed-frontside.png' });
  await page.evaluate(() => {
    const top = window.gameTest.world.bed.getObjectByName('cover_cover_top_0');
    top.material.polygonOffset = true;
    top.material.polygonOffsetFactor = -4;
    top.material.polygonOffsetUnits = -4;
    top.material.needsUpdate = true;
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/bed-top-offset-only.png' });
  await page.evaluate(() => {
    window.gameTest.world.bed.traverse((mesh) => {
      if (mesh.isMesh) mesh.visible = mesh.name === 'cover_cover_top_0';
    });
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/bed-top-only.png' });
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    window.bedReviewThree = THREE;
    const mesh = window.gameTest.world.bed.getObjectByName('cover_cover_top_0');
    mesh.material = new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/bed-basic-material.png' });
  await page.evaluate(() => {
    const { world } = window.gameTest;
    world.bed.traverse((mesh) => {
      if (mesh.isMesh) mesh.visible = true;
    });
    const top = world.bed.getObjectByName('cover_cover_top_0');
    top.material = window.gameTest.world.models
      .get('bed')
      .getObjectByName('cover_cover_bottom_0')
      .material.clone();
    top.material.normalMap = null;
    top.geometry = top.geometry.clone();
    top.geometry.deleteAttribute('tangent');
    const p = top.geometry.attributes.position;
    const positions = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      positions[i * 3] = p.getX(i);
      positions[i * 3 + 1] = p.getY(i);
      positions[i * 3 + 2] = p.getZ(i);
    }
    const THREE = window.bedReviewThree;
    top.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    top.geometry.deleteAttribute('normal');
    top.geometry.computeVertexNormals();
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/bed-recomputed-normals.png' });
} finally {
  await browser.close();
}
