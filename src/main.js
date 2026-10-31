import * as THREE from 'three';
import { makeModelWorld, METERS_PER_SIMULATION_UNIT } from './model-world.js';
import { Assets } from './assets.js';
import { bindModelRoute } from './model-route.js';
import { CollisionWorld, FIXED_STEP } from './physics.js';
import { Input } from './input.js';
import { CollisionDebug } from './collision-debug.js';
import { Player } from './player.js';
import { FollowCamera } from './camera.js';
import { makeModelSpider } from './model-spider.js';
import { Thread } from './rope.js';
import { makeAnchors, Route } from './route.js';
import { HumanThreat } from './threat.js';
import { Enemies } from './enemies.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Quality } from './quality.js';
import { installDiagnostics } from './diagnostics.js';
import { Sound } from './audio.js';
import { makeEffects } from './effects.js';
import { Ending } from './ending.js';

const element = (id) => document.getElementById(id);
let storage;
try {
  storage = localStorage;
} catch {
  storage = { getItem: () => null, setItem: () => {} };
}

async function boot() {
  const renderer = new THREE.WebGLRenderer({
    canvas: element('scene'),
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  const scene = new THREE.Scene();
  const assets = await new Assets().load((name, fraction) => {
    element('load-status').textContent = `Загрузка ${name} · ${Math.round(fraction * 100)}%`;
  });
  const world = makeModelWorld(scene, assets);
  const enemies = new Enemies(world);
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.005, 25);
  const simulationCamera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.035, 166);
  const renderPlayer = { renderPosition: new THREE.Vector3() };
  const collision = new CollisionWorld(world.solids);
  const player = new Player(collision);
  const collisionDebug = new CollisionDebug(world.root, collision, player);
  const spider = makeModelSpider(assets);
  world.root.add(spider.group);
  const follow = new FollowCamera(simulationCamera, collision);
  const anchors = makeAnchors(world.root, world.materials);
  bindModelRoute(world, collision, anchors);
  const thread = new Thread(world.root, anchors, collision);
  const threat = new HumanThreat(world.root, world.materials.skin);
  const route = new Route(world.root);
  const ui = new UI(storage);
  let game;
  const input = new Input(element('scene'), (force) => game?.pause(force));
  try {
    const saved = JSON.parse(storage.getItem('ruka-cela-mouse') || '{}');
    if (Number.isFinite(saved.sensitivity)) {
      input.sensitivity = THREE.MathUtils.clamp(saved.sensitivity, 0.25, 2);
    }
    input.invertY = saved.invertY === true;
  } catch {}
  element('sensitivity').value = input.sensitivity;
  element('invert-y').checked = input.invertY;
  function saveMouseSettings() {
    input.sensitivity = Number(element('sensitivity').value);
    input.invertY = element('invert-y').checked;
    try {
      storage.setItem(
        'ruka-cela-mouse',
        JSON.stringify({
          sensitivity: input.sensitivity,
          invertY: input.invertY,
        }),
      );
    } catch {}
  }
  element('sensitivity').oninput = saveMouseSettings;
  element('invert-y').onchange = saveMouseSettings;
  game = new Game(player, route, thread, threat, enemies, ui, input, storage);
  const sound = new Sound();
  const effects = makeEffects(renderer, scene, camera);
  const ending = new Ending(world, spider, simulationCamera, sound, storage);
  const quality = new Quality((level) => {
    renderer.setPixelRatio(
      level === 'low' ? 0.8 : level === 'medium' ? 1 : Math.min(devicePixelRatio, 1.25),
    );
    world.quality(level);
    effects.quality(level);
    element('quality').value = level;
  });
  let accumulator = 0;
  let last = performance.now();

  function start(full) {
    ending.reset();
    for (const anchor of anchors) {
      anchor.marker.visible = true;
      anchor.stalk.visible = true;
    }
    game.start(full);
    sound.start().catch(() => {
      element('sound').textContent = 'Звук недоступен';
    });
    accumulator = 0;
    follow.ready = false;
  }

  element('start').onclick = () => start(true);
  element('restart').onclick = () => start(true);
  element('menu').onclick = () => {
    ending.reset();
    game.setPhase('ready');
    camera.position.set(-2.5, 2.2, 3.1);
    camera.lookAt(0.4, 0.6, -0.6);
  };
  element('checkpoint').onclick = () => start(false);
  element('checkpoint-pause').onclick = () => start(false);
  element('pause').onclick = () => game.pause();
  element('resume').onclick = () => game.pause();
  element('sound').onclick = async () => {
    try {
      element('sound').textContent = (await sound.toggle()) ? 'Звук: вкл.' : 'Звук: выкл.';
    } catch {
      element('sound').textContent = 'Звук недоступен';
    }
  };
  element('quality').onchange = (event) => {
    if (game.phase === 'playing') game.pause(true);
    quality.select(event.target.value);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.pause(true);
  });
  camera.position.set(-2.5, 2.2, 3.1);
  camera.lookAt(0.4, 0.6, -0.6);
  element('load-status').textContent = 'Подготавливаем материалы, тени и постобработку…';
  const hiddenObjects = [];
  scene.traverse((object) => {
    if (!object.visible) {
      hiddenObjects.push(object);
      object.visible = true;
    }
  });
  await renderer.compileAsync(scene, camera);
  await effects.prepare();
  for (const object of hiddenObjects) object.visible = false;
  renderer.info.autoReset = false;
  effects.render();
  ui.phase('ready');
  last = performance.now();

  function frame(now) {
    const realDt = (now - last) / 1000;
    const dt = Math.min(realDt, 0.1);
    last = now;
    if (game.phase === 'playing') {
      input.sample();
      simulationCamera.updateMatrixWorld(true);
      thread.aim(simulationCamera, player, game.time);
      accumulator += dt;
      while (accumulator >= FIXED_STEP && game.phase === 'playing') {
        game.step(FIXED_STEP, world);
        accumulator -= FIXED_STEP;
      }
    } else accumulator = 0;
    player.interpolate(accumulator / FIXED_STEP);
    if (game.phase === 'ending') {
      if (!ending.active) {
        ending.begin(player);
        route.marker.visible = false;
        collisionDebug.group.visible = false;
        for (const anchor of anchors) {
          anchor.marker.visible = false;
          anchor.stalk.visible = false;
        }
      }
      if (ending.update(realDt)) game.finish();
    } else if (game.phase !== 'won') spider.update(player);
    collisionDebug.update();
    thread.render(player);
    if (game.phase !== 'ready') {
      if (!['ending', 'won'].includes(game.phase)) follow.update(player, input, dt, threat.shake);
      camera.position.copy(simulationCamera.position).multiplyScalar(METERS_PER_SIMULATION_UNIT);
      camera.quaternion.copy(simulationCamera.quaternion);
      camera.up.copy(simulationCamera.up);
    } else world.update(now / 1000);
    quality.sample(
      realDt,
      game.phase === 'playing',
      game.phase !== 'playing' ||
        (route.justCheckpoint && player.speed < 0.1 && !thread.anchor && threat.warning === 0),
    );
    ui.update(now, game, player, route, threat, enemies, thread, input, quality);
    if (game.phase !== 'ending') sound.update(game, player, threat, enemies);
    renderPlayer.renderPosition
      .copy(player.renderPosition)
      .multiplyScalar(METERS_PER_SIMULATION_UNIT);
    if (game.phase === 'ending' || game.phase === 'won') {
      renderPlayer.renderPosition
        .copy(spider.group.position)
        .multiplyScalar(METERS_PER_SIMULATION_UNIT);
    }
    effects.update(game.time + ending.time, renderPlayer);
    renderer.info.reset();
    effects.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    simulationCamera.aspect = camera.aspect;
    simulationCamera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    effects.resize();
  });
  installDiagnostics({
    ending,
    collisionDebug,
    game,
    player,
    follow,
    thread,
    threat,
    enemies,
    route,
    input,
    renderer,
    quality,
    world,
    camera: simulationCamera,
    sound,
  });
}

boot().catch((error) => {
  element('error').classList.remove('hidden');
  element('error').textContent =
    `Не удалось загрузить игру: ${error.message}. Проверь доступность файлов моделей и локального сервера. Для ошибок графики проверь аппаратное ускорение Chrome.`;
  console.error(error);
});
