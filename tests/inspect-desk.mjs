import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const page = await browser.newPage();
  await page.goto(process.argv[2]);
  await page.waitForFunction(() => window.gameDiagnostics);
  console.log(
    JSON.stringify(
      await page.evaluate(async () => {
        const THREE = await import('/node_modules/three/build/three.module.js');
        const { Assets } = await import('/src/assets.js');
        const assets = await new Assets().load();
        const model = assets.instantiate('desk');
        model.updateMatrixWorld(true);
        const ray = new THREE.Raycaster();
        const rows = [];
        for (const y of [0.03, 0.1, 0.2, 0.5, 0.74, 0.77]) {
          const hits = [];
          for (let x = -1; x <= 1; x += 0.02) {
            ray.set(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
            const hit = ray.intersectObject(model, true)[0];
            if (hit) hits.push([+x.toFixed(2), +hit.point.z.toFixed(3)]);
          }
          rows.push({ y, hits });
        }
        const spider = assets.instantiate('spider');
        spider.updateMatrixWorld(true);
        const bones = [];
        spider.traverse((o) => {
          if (o.isBone) bones.push([o.name, o.getWorldPosition(new THREE.Vector3()).toArray()]);
        });
        return { rows, bones };
      }),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
