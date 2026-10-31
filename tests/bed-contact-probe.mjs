import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${process.argv[2]}/?test-controls`);
  await page.waitForFunction(() => window.gameTest, null, { timeout: 90000 });
  console.log(
    JSON.stringify(
      await page.evaluate(async () => {
        const { player, game } = window.gameTest;
        const THREE = await import('/node_modules/three/build/three.module.js');
        game.setPhase('paused');
        player.reset(new THREE.Vector3(4, 2.337, -12));
        const contacts = [];
        const original = player.contact.bind(player);
        player.contact = (hit) => {
          contacts.push({
            p: hit.point.toArray(),
            n: hit.normal.toArray(),
            solid: hit.solid.name,
            part: hit.solid.part,
          });
          if (contacts.length > 12) contacts.shift();
          original(hit);
        };
        for (let i = 0; i < 1440; i++)
          player.step(1 / 120, { yaw: 0, pitch: 0.15, vertical: 1, horizontal: 0, descend: true });
        return { contacts, p: player.position.toArray(), n: player.normal.toArray() };
      }),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
