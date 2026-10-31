import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${process.argv[2]}/?debug`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  console.log(
    JSON.stringify(
      await page.evaluate(async () => {
        const { world, ending } = window.gameTest;
        const meshes = [];
        world.human.root.traverse((m) => {
          if (!m.isMesh) return;
          const p = m.geometry.attributes.position;
          meshes.push({
            name: m.name,
            type: p.array.constructor.name,
            normalized: p.normalized,
            count: p.count,
            skinned: m.isSkinnedMesh,
          });
        });
        return {
          meshes,
          skin: ending.skin.map((s) => s.mesh.name),
          solids: world.solids.map((s) => ({
            name: s.name,
            type: s.type,
            closed: s.closed,
            moving: s.moving,
            triangles: s.geometry?.attributes.position.count / 3,
          })),
        };
      }),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
